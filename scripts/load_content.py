"""Merge per-concept drafts from data/content/ into data/*.json, then validate.

Inputs (either or both per concept, Prompt 0A / 0B formats):
  data/content/<concept>_items.json  array of items
  data/content/<concept>_cards.json  {concept_card, remediation_cards, exemplars, contrast_probes, verify_flags}
Concept names, zones and the misconception code list stay as they are in data/concepts.json and
data/misconceptions.json; any item using a code not listed there is rejected.

Usage: python scripts/load_content.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.content import CORRECT, DATA_DIR, SLIP, UNMAPPED  # noqa: E402
from scripts.validate_content import validate  # noqa: E402

SRC = DATA_DIR / "content"


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(name: str, rows) -> None:
    (DATA_DIR / name).write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    concepts, misconceptions = read(DATA_DIR / "concepts.json"), read(DATA_DIR / "misconceptions.json")
    items, cards = read(DATA_DIR / "items.json"), read(DATA_DIR / "cards.json")
    codes = {m["code"] for m in misconceptions}
    rejected = []

    for concept in concepts:
        cid = concept["concept_id"]
        items_file, cards_file = SRC / f"{cid}_items.json", SRC / f"{cid}_cards.json"

        if items_file.exists():
            new = []
            for item in read(items_file):
                bad = {c for c in item.get("distractor_map", {}).values() if c not in codes | {CORRECT, SLIP, UNMAPPED}}
                bad |= {r["maps_to"] for r in item.get("reasons", {}).values() if r["maps_to"] not in codes | {CORRECT}}
                bad |= {p["code"] for p in item.get("patterns", []) if p["code"] not in codes}
                bad |= {s["trap"] for s in item.get("steps", []) if s["trap"] not in codes | {SLIP}}
                if item.get("concept") != cid or bad:
                    rejected.append(f"{item.get('item_id')}: concept {item.get('concept')!r}, unknown codes {sorted(bad)}")
                else:
                    new.append(item)
            items = [i for i in items if i["concept"] != cid] + new
            print(f"{cid}: {len(new)} items")

        if cards_file.exists():
            draft = read(cards_file)
            flags = draft.get("verify_flags", [])
            k = draft["concept_card"]
            mine = {m["code"] for m in misconceptions if m["concept"] == cid}
            cards = [c for c in cards if c["concept"] != cid]
            cards.append({**k, "concept": cid, "verify_flags": flags})
            for r in draft["remediation_cards"]:
                if r["code"] not in mine:
                    rejected.append(f"{r['card_id']}: code {r['code']} is not a {cid} code")
                    continue
                cards.append({
                    "card_id": f"{r['code']}-R", "concept": cid, "code": r["code"], "statement": r["correct_idea"],
                    "wrong_idea": r["wrong_idea"], "why_it_feels_right": r["why_it_feels_right"],
                    "why_wrong": r["why_wrong"], "sim_moment": r["sim_moment"], "verify_flags": flags,
                })
            probes = draft.get("contrast_probes", [])
            concept.update(summary=k["statement"], contrast_probes=probes,
                           correct_exemplars=draft["exemplars"].get(CORRECT, []), doubts=draft.get("doubts", []),
                           learning_objective=k.get("learning_objective", ""),
                           subtopic=k.get("subtopic") or concept.get("subtopic", ""))
            for m in misconceptions:
                if m["code"] in mine:
                    vs_correct = [p["probe"] for p in probes if set(p["separates"]) == {m["code"], CORRECT}]
                    m.update(exemplars=draft["exemplars"].get(m["code"], []), remediation_card_id=f"{m['code']}-R",
                             contrast_probe=vs_correct[0] if vs_correct else m["contrast_probe"], verify_flags=flags)
            print(f"{cid}: cards, exemplars and {len(probes)} probes")

    order = {c["concept_id"]: n for n, c in enumerate(concepts)}
    kind_order = {"mcq": 0, "short": 1}
    items.sort(key=lambda i: (order[i["concept"]], i["is_assessment"], kind_order[i.get("kind", "mcq")], i["item_id"]))
    for m in misconceptions:  # follow-ups: practice items that can surface this code
        m["followup_item_ids"] = [
            i["item_id"] for i in items
            if not i["is_assessment"]
            and (m["code"] in i.get("distractor_map", {}).values() or m["code"] in {p["code"] for p in i.get("patterns", [])})
        ]

    for r in rejected:
        print(f"REJECTED {r}")
    write("concepts.json", concepts)
    write("misconceptions.json", misconceptions)
    write("items.json", items)
    write("cards.json", cards)

    errors = validate()
    for e in errors:
        print(f"ERROR {e}")
    print("OK: merged and valid" if not errors and not rejected else "merged with problems")
    return 1 if errors or rejected else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
    sys.exit(main())
