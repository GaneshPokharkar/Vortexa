"""Mistake tracer for numeric answers.

Each numeric question carries its solution as a formula over named inputs. The tracer applies known mistakes to that
solution (dropped ½, missed square or root, × for ÷, a flipped sign, cm for m, one quantity used for another, plus any
wrong formulas the author lists), one at a time and in pairs, and computes the number each path gives. A student's
number that matches exactly one path tells us how they probably worked; one that matches several is ambiguous, so the
tutor asks instead of guessing. Pure code, no AI: the rules stay explainable and repeatable.
"""
from __future__ import annotations

import ast
import copy
import math
from dataclasses import dataclass
from itertools import combinations
from typing import Callable, Optional

FUNCS = {
    "sqrt": math.sqrt, "pi": math.pi,
    "sind": lambda d: math.sin(math.radians(d)), "asind": lambda s: math.degrees(math.asin(s)),
}
HABITS = {"HALF", "ROOT", "SQUARE", "SIGN", "UNIT", "ARITH"}  # careless working; any other tag is a misconception code
REL_TOL = 0.015  # a student's number within 1.5 % of a path's value counts as that path
OPTION_TOL = 0.03  # option labels are rounded to 2 significant figures


@dataclass(frozen=True)
class Path:
    value: float
    steps: tuple[str, ...]  # what the student did differently, in words
    tags: tuple[str, ...]  # habit codes (HALF, ROOT, ...) and/or misconception codes


@dataclass
class Match:
    number: float
    paths: list[Path]  # every path within tolerance (singles preferred over pairs)

    @property
    def unique(self) -> Optional[Path]:
        return self.paths[0] if len({p.steps for p in self.paths}) == 1 else None


@dataclass(frozen=True)
class Mutation:
    text: str
    tags: tuple[str, ...]
    sites: tuple[tuple[int, Callable[[ast.AST], ast.AST]], ...] = ()  # (node index in the original formula, rewrite)
    env: Optional[Callable[[dict], dict]] = None


def _apply(tree: ast.AST, env: dict, muts: tuple[Mutation, ...]) -> tuple[ast.AST, dict]:
    """Apply mutations together: formula rewrites are located on the original formula and applied bottom-up."""
    sites = {i: f for m in muts for i, f in m.sites}
    if len(sites) < sum(len(m.sites) for m in muts):
        raise ValueError("two changes at the same place")
    tree = copy.deepcopy(tree)
    targets = {id(n): sites[i] for i, n in enumerate(ast.walk(tree)) if i in sites}

    class R(ast.NodeTransformer):
        def visit(self, node):
            node = self.generic_visit(node)
            return targets[id(node)](node) if id(node) in targets else node
    tree = ast.fix_missing_locations(R().visit(tree))
    for m in muts:
        if m.env:
            env = m.env(env)
    return tree, env


def _eval(tree: ast.AST, env: dict) -> Optional[float]:
    # Formulas come from the content files (authored and validated), never from students.
    try:
        v = eval(compile(ast.Expression(tree), "<trace>", "eval"), {"__builtins__": {}}, {**FUNCS, **env})  # noqa: S307
    except (ValueError, ZeroDivisionError, OverflowError, TypeError):
        return None
    return float(v) if isinstance(v, (int, float)) and math.isfinite(v) else None


def _num(node: ast.AST) -> Optional[float]:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) else None


def _tree_mutations(tree: ast.AST, meaning: dict, allow: set[str]) -> list[Mutation]:
    """Mistakes found in the formula's shape. `meaning` can relabel a kind of mistake for this question; "muldiv"
    (× for ÷) only runs where the question allows it, because applied everywhere it mostly makes noise."""
    out: list[Mutation] = []

    def add(kind: str, text: str, tags: tuple[str, ...], index: int, new: Callable[[ast.AST], ast.AST]):
        m = meaning.get(kind, {})
        out.append(Mutation(m.get("text", text), tuple(m.get("tags", tags)), ((index, new),)))

    for i, node in enumerate(ast.walk(tree)):
        if not isinstance(node, ast.BinOp):
            if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "sqrt":
                add("root", "left out the square root", ("ROOT",), i, lambda n: n.args[0])
            continue
        left, right = _num(node.left), _num(node.right)
        if isinstance(node.op, ast.Mult) and 0.5 in (left, right):
            add("half", "left out the ½", ("HALF",), i, lambda n: n.right if _num(n.left) == 0.5 else n.left)
        elif isinstance(node.op, ast.Div) and right == 2:
            add("half", "left out the ÷ 2", ("HALF",), i, lambda n: n.left)
        elif isinstance(node.op, ast.Pow) and right == 2:
            add("square", f"used {ast.unparse(node.left)} instead of {ast.unparse(node.left)}²", ("SQUARE",), i, lambda n: n.left)
        elif isinstance(node.op, ast.Mult) and {type(node.left), type(node.right)} <= {ast.Constant, ast.Name} \
                and "pi" in (getattr(node.left, "id", ""), getattr(node.right, "id", "")):
            add("twopi", f"left out the {ast.unparse(node).replace('*pi', 'π')}", ("ARITH",), i, lambda n: ast.Constant(1))
        if "muldiv" in allow and isinstance(node.op, (ast.Mult, ast.Div)) and not (isinstance(node.op, ast.Mult) and 0.5 in (left, right)) \
                and not (isinstance(node.op, ast.Div) and right == 2):
            swapped = "divided" if isinstance(node.op, ast.Mult) else "multiplied"
            add("muldiv", f"{swapped} instead of {'multiplying' if swapped == 'divided' else 'dividing'} in "
                          f"{ast.unparse(node).replace('*pi', 'π')}", ("ARITH",), i,
                lambda n: ast.BinOp(n.left, ast.Div() if isinstance(n.op, ast.Mult) else ast.Mult(), n.right))
    return out


def _input_mutations(inputs: dict, swaps: list[dict], meaning: dict) -> list[Mutation]:
    out: list[Mutation] = []
    for name, spec in inputs.items():
        v, unit = spec["value"], spec.get("unit", "")
        if spec.get("signed") and v != 0:
            m = meaning.get(f"sign:{name}", {})
            out.append(Mutation(m.get("text", f"used {name} = {_fmt(-v)} {unit} (sign flipped)"), tuple(m.get("tags", ("SIGN",))),
                                env=lambda e, n=name: {**e, n: -e[n]}))
        if unit == "m":
            out.append(Mutation(f"used {name} in cm ({_fmt(v * 100)}) instead of metres", ("UNIT",),
                                env=lambda e, n=name: {**e, n: e[n] * 100}))
    for s in swaps:
        out.append(Mutation(s["text"], tuple(s["tags"]), env=lambda e, a=s["use"], b=s["for"]: {**e, b: e[a]}))
    return out


def _fmt(x: float) -> str:
    return f"{x:g}"


def paths(trace: dict) -> list[Path]:
    """Every wrong path (one or two mistakes, plus listed wrong formulas), excluding ones that give the right number."""
    tree = ast.parse(trace["formula"], mode="eval").body
    env = {k: v["value"] for k, v in trace["inputs"].items()}
    right = _eval(tree, env)
    meaning = trace.get("meaning", {})
    singles = _tree_mutations(tree, meaning, set(trace.get("allow", []))) +         _input_mutations(trace["inputs"], trace.get("swaps", []), meaning)
    found: dict[tuple, Path] = {}

    def keep(value: Optional[float], steps: tuple[str, ...], tags: tuple[str, ...]):
        if value is None or (right is not None and math.isclose(value, right, rel_tol=1e-6, abs_tol=1e-12)):
            return
        found.setdefault((round(value, 9), steps), Path(value, steps, tags))

    alone = {}
    for m in singles:
        alone[m] = _eval(*_apply(tree, env, (m,)))
        keep(alone[m], (m.text,), m.tags)
    for m1, m2 in combinations(singles, 2):
        try:
            v = _eval(*_apply(tree, env, (m1, m2)))
        except (ValueError, AttributeError, IndexError):  # both change the same spot, or one removes the other's target
            continue
        if v is None or any(a is not None and math.isclose(v, a, rel_tol=1e-6) for a in (alone[m1], alone[m2], right)):
            continue  # one of the two changes made no difference: that's a single mistake, already listed
        keep(v, (m1.text, m2.text), tuple(dict.fromkeys(m1.tags + m2.tags)))
    for alt in trace.get("alternatives", []):
        keep(_eval(ast.parse(alt["formula"], mode="eval").body, env), (alt["text"],), tuple(alt["tags"]))
    return sorted(found.values(), key=lambda p: (len(p.steps), p.value))


def right_answer(trace: dict) -> Optional[float]:
    return _eval(ast.parse(trace["formula"], mode="eval").body, {k: v["value"] for k, v in trace["inputs"].items()})


def match(trace: dict, numbers: list[float], rel_tol: float = REL_TOL) -> Optional[Match]:
    """The first number in the answer that fits any path. Single-mistake paths win over pairs (simplest story)."""
    every = paths(trace)
    for x in numbers:
        near = [p for p in every if math.isclose(x, p.value, rel_tol=rel_tol, abs_tol=1e-9)]
        if near:
            fewest = min(len(p.steps) for p in near)
            return Match(x, [p for p in near if len(p.steps) == fewest])
    return None


def option_path(trace: dict, option: str) -> Optional[Path]:
    """The one wrong path a multiple-choice option's number comes from (options listed in trace["option_values"])."""
    value = trace.get("option_values", {}).get(option)
    m = match(trace, [value], OPTION_TOL) if value is not None else None
    return m.unique if m else None
