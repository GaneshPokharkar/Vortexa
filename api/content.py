"""Content schema (Pydantic) and loader for data/*.json."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

CORRECT, SLIP, UNMAPPED = "CORRECT", "SLIP", "UNMAPPED"
Option = Literal["A", "B", "C", "D"]
ReasonId = Literal["r1", "r2", "r3"]


class Concept(BaseModel):
    concept_id: str
    name: str
    zone: str
    summary: str


class Reason(BaseModel):
    text: str
    maps_to: str


class Item(BaseModel):
    item_id: str
    concept: str
    is_assessment: bool = False
    stem: str
    options: dict[Option, str]
    correct: Option
    distractor_map: dict[Option, str]
    reasons: dict[ReasonId, Reason]
    sibling_of: Optional[str] = None
    status: Optional[str] = None

    @model_validator(mode="after")
    def _check(self) -> "Item":
        if set(self.options) != {"A", "B", "C", "D"} or set(self.distractor_map) != set(self.options):
            raise ValueError(f"{self.item_id}: options and distractor_map must cover A-D")
        if self.distractor_map[self.correct] != CORRECT:
            raise ValueError(f"{self.item_id}: distractor_map[correct] must be 'CORRECT'")
        wrong = [c for o, c in self.distractor_map.items() if o != self.correct]
        if CORRECT in wrong:
            raise ValueError(f"{self.item_id}: only the correct option may map to 'CORRECT'")
        if set(self.reasons) != {"r1", "r2", "r3"}:
            raise ValueError(f"{self.item_id}: reasons must be r1-r3")
        if [r.maps_to for r in self.reasons.values()].count(CORRECT) != 1:
            raise ValueError(f"{self.item_id}: exactly one reason must map to 'CORRECT'")
        return self

    def public(self) -> dict:
        """What the learner sees: no answer key."""
        return {
            "item_id": self.item_id,
            "concept": self.concept,
            "stem": self.stem,
            "options": self.options,
            "reasons": {rid: r.text for rid, r in self.reasons.items()},
        }


class Misconception(BaseModel):
    code: str
    concept: str
    description: str
    exemplars: list[str] = Field(min_length=8)
    remediation_card_id: str
    followup_item_ids: list[str]
    contrast_probe: str
    status: Optional[str] = None


class Card(BaseModel):
    card_id: str
    concept: str
    statement: str
    worked_example: str
    analogy: str
    steps: list[str]
    wrong_idea: str
    why_wrong: str
    status: Optional[str] = None


class Content(BaseModel):
    concepts: list[Concept]
    misconceptions: dict[str, Misconception]
    items: dict[str, Item]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def _cross_check(self) -> "Content":
        concept_ids = {c.concept_id for c in self.concepts}
        codes = set(self.misconceptions)
        errors = []
        for i in self.items.values():
            if i.concept not in concept_ids:
                errors.append(f"{i.item_id}: unknown concept {i.concept}")
            for c in i.distractor_map.values():
                if c not in codes | {CORRECT, SLIP, UNMAPPED}:
                    errors.append(f"{i.item_id}: unknown option code {c}")
            for r in i.reasons.values():
                if r.maps_to not in codes | {CORRECT}:
                    errors.append(f"{i.item_id}: reasons may map only to 'CORRECT' or a code, got {r.maps_to}")
            if i.sibling_of and i.sibling_of not in self.items:
                errors.append(f"{i.item_id}: sibling_of {i.sibling_of} not found")
        for m in self.misconceptions.values():
            if m.remediation_card_id not in self.cards:
                errors.append(f"{m.code}: card {m.remediation_card_id} not found")
            errors += [f"{m.code}: follow-up {f} not found" for f in m.followup_item_ids if f not in self.items]
        if errors:
            raise ValueError("; ".join(errors))
        return self


def _read(name: str, key: Optional[str] = None):
    rows = json.loads((DATA_DIR / name).read_text(encoding="utf-8"))
    if key is None:
        return rows
    by_key = {r[key]: r for r in rows}
    if len(by_key) != len(rows):
        raise ValueError(f"{name}: duplicate {key}")
    return by_key


@lru_cache
def load_content() -> Content:
    return Content(
        concepts=_read("concepts.json"),
        misconceptions=_read("misconceptions.json", "code"),
        items=_read("items.json", "item_id"),
        cards=_read("cards.json", "card_id"),
    )
