"""The 3-agent diagnosis pipeline.

  1. Evaluator        — is the answer right, and is there a reason?    rules always; Claude cross-checks free text (live)
  2. Diagnoser        — which misconception, with quoted evidence?      rules first; Claude only if rules find nothing
  3. Visual corrector — which overlay, with what exact numbers?         physics code only, never a language model

Rules make the final call. Claude can add evidence, and when Claude and the rules disagree the student is asked a
clarifying question: neither side silently wins. Every stage is recorded so "Why this diagnosis?" can show it.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from typing import Optional

from api import engine as eng
from api.ai import llm
from api.content import CORRECT, Item, load_content
from api.engine.grading import (
    AMBIGUOUS, CORRECT_CATEGORIES, FALSE_POSITIVE, LACK_OF_KNOWLEDGE, MISCONCEPTION, PARTIAL, SLIP_CATEGORIES,
)
from api.engine.overlay import visual_correction
from api.engine.short import ShortResult, grade_short

DISAGREE_CONFIDENCE = 0.75  # Claude must be at least this sure before its disagreement triggers a clarifying question


@dataclass
class Stage:
    stage: str  # evaluate | diagnose | visualize
    agent: str  # human-readable agent name
    engine: str  # rules | claude | physics
    outcome: str
    ms: int


def _verdict(category: str) -> str:
    if category in CORRECT_CATEGORIES or category == PARTIAL:
        return "correct"
    if category in (MISCONCEPTION, LACK_OF_KNOWLEDGE) or category in SLIP_CATEGORIES:
        return "incorrect"
    return "unclear"


def _ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)


def run_short(item: Item, text: str, confidence: str = "sure") -> tuple[ShortResult, list[dict]]:
    stages: list[Stage] = []
    t0 = time.perf_counter()
    rules = grade_short(item, text, confidence)
    live = llm.live()
    needs_diagnoser = rules.rule_fired in ("short:unmatched", "short:off-topic")

    evaluation, hint = None, None
    if live:  # both Claude agents run in parallel when both are needed
        with ThreadPoolExecutor(max_workers=2) as pool:
            ev_future = pool.submit(llm.evaluate, item, text)
            cl_future = pool.submit(llm.classify, item, text,
                                    {m.code: m.description for m in load_content().misconceptions.values()}) \
                if needs_diagnoser else None
            evaluation = ev_future.result()
            hint = cl_future.result() if cl_future else None

    # ---- stage 1: evaluator
    rules_verdict = _verdict(rules.category)
    result = rules
    if evaluation:
        claude_says = f"Claude: {evaluation['verdict']} (confidence {evaluation['confidence']:.2f})"
        disagree = (rules_verdict in ("correct", "incorrect") and evaluation["verdict"] in ("correct", "incorrect")
                    and evaluation["verdict"] != rules_verdict and evaluation["confidence"] >= DISAGREE_CONFIDENCE)
        if disagree:
            result = ShortResult(
                AMBIGUOUS, "orchestrator:disagree", None,
                [f"The rules read your answer as {rules_verdict}, but the AI evaluator read it as {evaluation['verdict']}.",
                 "Rather than pick one, the tutor will ask you a quick question."],
                None, "UNCLEAR", "llm")
            outcome = f"Rules: {rules_verdict}. {claude_says}. They disagree, so the tutor asks first."
        else:
            outcome = f"Rules: {rules_verdict}. {claude_says}. " + ("They agree." if evaluation["verdict"] == rules_verdict
                                                                   else "No conflict that changes the outcome.")
        stages.append(Stage("evaluate", "Evaluator", "rules+claude", outcome, _ms(t0)))
    else:
        note = "" if not live else " (Claude unavailable for this answer; rules only)"
        stages.append(Stage("evaluate", "Evaluator", "rules", f"Rules: {rules_verdict}{note}.", _ms(t0)))

    # ---- stage 2: diagnoser
    t1 = time.perf_counter()
    if result.rule_fired != "orchestrator:disagree" and needs_diagnoser and hint is not None:
        result = grade_short(item, text, confidence, llm=hint)
        stages.append(Stage("diagnose", "Diagnoser", "claude",
                            f"Rules found no match; Claude proposed {hint.label} ({hint.confidence:.2f}) quoting “{hint.quote}”. "
                            f"Rules {'accepted it' if result.engine == 'llm' else 'kept it as unclear'}.", _ms(t1)))
    else:
        found = f"misconception {result.code}" if result.code else "no misconception"
        stages.append(Stage("diagnose", "Diagnoser", "rules", f"{found.capitalize()} ({result.rule_fired}).", _ms(t1)))

    stages.append(_visualize(item, result.category, result.code))
    return result, [asdict(s) for s in stages]


def mcq_stages(item: Item, g: "eng.Grade") -> list[dict]:
    """Multiple choice has an answer key and linked options, so stages 1-2 are rules; stage 3 is the same."""
    verdict = "correct" if g.option_code == CORRECT else "incorrect"
    reason = "correct" if g.reason_code == CORRECT else (g.reason_code or "own words")
    stages = [
        Stage("evaluate", "Evaluator", "rules", f"Option {verdict}; reason {reason}.", 0),
        Stage("diagnose", "Diagnoser", "rules",
              f"{g.category} via {g.rule_fired}" + (f", misconception {g.misconception_code}" if g.misconception_code else "") + ".", 0),
        _visualize(item, g.category, g.misconception_code),
    ]
    return [asdict(s) for s in stages]


def _visualize(item: Item, category: str, code: Optional[str]) -> Stage:
    t = time.perf_counter()
    spec = visual_correction(code, item.setup) if category in (MISCONCEPTION, FALSE_POSITIVE) else None
    outcome = (f"Overlay '{spec['overlay']}' on the {spec['visual']} visual, numbers computed from the question's setup."
               if spec else "No overlay for this answer.")
    return Stage("visualize", "Visual corrector", "physics", outcome, _ms(t))


def overlay_for(item: Item, category: str, code: Optional[str]) -> Optional[dict]:
    return visual_correction(code, item.setup) if category in (MISCONCEPTION, FALSE_POSITIVE) else None
