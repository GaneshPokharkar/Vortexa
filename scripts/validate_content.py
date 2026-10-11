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


def check(c: Content) -> list[str]:
    """Content-model rules beyond the schema (which load_content already enforces)."""
    errors: list[str] = []
    codes_of = {x.concept_id: {m.code for m in c.misconceptions.values() if m.concept == x.concept_id} for x in c.concepts}
    multi_code_items = 0

    for concept, codes in codes_of.items():
        items = [i for i in c.items.values() if i.concept == concept]
        ids = sorted(i.item_id for i in items)
        if ids != sorted([f"{concept}-P1", f"{concept}-P2", f"{concept}-P3", f"{concept}-A1"]):
            errors.append(f"{concept}: expected items P1-P3 + A1, got {ids}")
        targeted = {code: 0 for code in codes}
        for i in items:
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
            if not i.stem.strip() or any(not o.strip() for o in i.options.values()):
                errors.append(f"{i.item_id}: empty stem or option")
            if i.is_assessment and i.sibling_of:
                errors.append(f"{i.item_id}: assessment items have no sibling")
        for n in (2, 3):
            item = c.items.get(f"{concept}-P{n}")
            if item and item.sibling_of != f"{concept}-P1":
                errors.append(f"{item.item_id}: sibling_of must be {concept}-P1")
        errors += [f"{concept}: code {code} targeted by {k} wrong options (need >= 2)" for code, k in targeted.items() if k < 2]
        if f"{concept}-K" not in c.cards:
            errors.append(f"{concept}: missing concept card {concept}-K")

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
        wrong = " · ".join(f"{o}:{code}" for o, code in i.distractor_map.items() if o != i.correct)
        tag = " *(assessment)*" if i.is_assessment else ""
        stem = i.stem.replace("|", "/")
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
