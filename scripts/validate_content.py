"""Validate data/*.json against the WaveLoop content model.

Usage: python scripts/validate_content.py [--table]
Exit code 1 on any error. --table prints every item as a markdown table for physics review.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pydantic import ValidationError  # noqa: E402

from api.content import CORRECT, SLIP, UNMAPPED, Content, load_content  # noqa: E402

EXEMPLARS_PER_CODE = 12


EXPECTED_IDS = ["P1", "P2", "P3", "A1", "Q1", "Q2", "A2"]


def check(c: Content) -> list[str]:
    """Content-model rules beyond the schema (which load_content already enforces)."""
    errors: list[str] = []
    codes_of = {x.concept_id: {m.code for m in c.misconceptions.values() if m.concept == x.concept_id} for x in c.concepts}
    multi_code_items = 0

    for concept, codes in codes_of.items():
        items = [i for i in c.items.values() if i.concept == concept]
        missing = {f"{concept}-{x}" for x in EXPECTED_IDS} - {i.item_id for i in items}
        if missing:
            errors.append(f"{concept}: missing items {sorted(missing)}")  # extra items (P4, Q3...) are allowed
        if not any(i.transfer and not i.is_assessment for i in items):
            errors.append(f"{concept}: needs a practice transfer item")
        targeted = {code: 0 for code in codes}
        in_patterns: set[str] = set()
        for i in items:
            if not i.stem.strip():
                errors.append(f"{i.item_id}: empty stem")
            if i.is_assessment and i.sibling_of:
                errors.append(f"{i.item_id}: assessment items have no sibling")
            if i.kind == "short":
                for pat in i.patterns:
                    if pat.code not in codes:
                        errors.append(f"{i.item_id}: pattern code {pat.code} is not a {concept} code")
                    in_patterns.add(pat.code)
                    clash = set(pat.any) & set(i.accept_any)
                    if clash:
                        errors.append(f"{i.item_id}: phrases both correct and {pat.code}: {sorted(clash)}")
                continue
            wrong = [code for opt, code in i.distractor_map.items() if opt != i.correct]
            for code in wrong:
                if code not in codes | {SLIP, UNMAPPED}:
                    errors.append(f"{i.item_id}: wrong option maps to {code}, not a {concept} code")
                if code in targeted:
                    targeted[code] += 1
            if sum(code in (SLIP, UNMAPPED) for code in wrong) > 1:
                errors.append(f"{i.item_id}: more than one SLIP/UNMAPPED option")
            if len({code for code in wrong if code in codes}) >= 2:
                multi_code_items += 1
            for rid, r in i.reasons.items():
                if r.maps_to not in codes | {CORRECT}:
                    errors.append(f"{i.item_id}.{rid}: maps to {r.maps_to}, not a {concept} code")
            if any(not o.strip() for o in i.options.values()):
                errors.append(f"{i.item_id}: empty option")
        for item in items:
            practice_mcq = item.kind == "mcq" and not item.is_assessment and item.item_id != f"{concept}-P1"
            if practice_mcq and item.sibling_of != f"{concept}-P1":
                errors.append(f"{item.item_id}: sibling_of must be {concept}-P1")
        errors += [f"{concept}: code {code} targeted by {k} wrong options (need >= 2)" for code, k in targeted.items() if k < 2]
        errors += [f"{concept}: code {code} missing from short-answer patterns" for code in codes - in_patterns]
        card = c.cards.get(f"{concept}-K")
        if card is None:
            errors.append(f"{concept}: missing concept card {concept}-K")
        elif not (card.simple and card.formal and card.equations and card.worked_example):
            errors.append(f"{concept}-K: needs simple, formal, equations and worked_example")

    if multi_code_items < 2:
        errors.append(f"only {multi_code_items} items have two wrong options with two different codes (need >= 2)")

    for m in c.misconceptions.values():
        if len(m.exemplars) < EXEMPLARS_PER_CODE:
            errors.append(f"{m.code}: {len(m.exemplars)} exemplars (need {EXEMPLARS_PER_CODE})")
        errors += [f"{m.code}: exemplar names the code: {e!r}" for e in m.exemplars if m.code.lower() in e.lower().split()]
        if not m.contrast_probe.strip() or "TODO" in m.contrast_probe:
            errors.append(f"{m.code}: missing contrast_probe")
        card = c.cards.get(m.remediation_card_id)
        if card is None or card.code != m.code:
            errors.append(f"{m.code}: remediation card {m.remediation_card_id} missing or not linked to the code")
    return errors


def validate() -> list[str]:
    load_content.cache_clear()
    try:
        content = load_content()
    except (ValidationError, ValueError) as e:
        return [str(e)]
    return check(content)


def table(c: Content) -> str:
    rows = ["| ID | Stem | Correct | Wrong options → code |", "|---|---|---|---|"]
    for i in c.items.values():
        tag = " *(assessment)*" if i.is_assessment else ""
        stem = i.stem.replace("|", "/")
        if i.kind == "short":
            wrong = " · ".join(p.code for p in i.patterns)
            rows.append(f"| {i.item_id}{tag} (short) | {stem} | {i.answer_key.replace('|', '/')} | {wrong} |")
            continue
        wrong = " · ".join(f"{o}:{code}" for o, code in i.distractor_map.items() if o != i.correct)
        rows.append(f"| {i.item_id}{tag} | {stem} | {i.correct}: {i.options[i.correct].replace('|', '/')} | {wrong} |")
    return "\n".join(rows)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
    errors = validate()
    if "--table" in sys.argv and not errors:
        print(table(load_content()))
    for e in errors:
        print(f"ERROR {e}")
    print("OK: content valid" if not errors else f"{len(errors)} error(s)")
    sys.exit(1 if errors else 0)
