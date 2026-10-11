"""Content schema (Pydantic) and loader for data/*.json. Content is data, kept apart from logic so teachers can review it."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, model_validator

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

CORRECT, SLIP, UNMAPPED = "CORRECT", "SLIP", "UNMAPPED"
Option = Literal["A", "B", "C", "D"]
ReasonId = Literal["r1", "r2", "r3"]


class Probe(BaseModel):
    separates: list[str]  # two of: misconception codes / "CORRECT"
    probe: str
    reply_if_first: str = ""
    reply_if_second: str = ""


class Doubt(BaseModel):
    q: str
    a: str


class Topic(BaseModel):
    topic_id: str
    title: str
    description: str
    primary: bool = False


class Concept(BaseModel):
    concept_id: str
    name: str
    topic_id: str = "SHM"
    subtopic: str = ""
    zone: str = ""  # deprecated, old screens only
    summary: str = ""
    learning_objective: str = ""
    review_status: Literal["needs_review", "verified"] = "needs_review"
    contrast_probes: list[Probe] = []
    correct_exemplars: list[str] = []
    doubts: list[Doubt] = []

    def public(self) -> dict:
        return self.model_dump(exclude={"contrast_probes", "correct_exemplars", "doubts"})


class Reason(BaseModel):
    text: str
    maps_to: str


class Pattern(BaseModel):
    code: str
    any: list[str]


class Slip(BaseModel):
    value: float
    why: str


class Numeric(BaseModel):
    value: float
    unit: str = ""
    tolerance: float  # absolute
    slips: list[Slip] = []


class Item(BaseModel):
    item_id: str
    concept: str
    kind: Literal["mcq", "short"] = "mcq"
    is_assessment: bool = False
    transfer: bool = False
    stem: str
    sibling_of: Optional[str] = None
    calc: str = ""
    verify_flags: list[str] = []
    # multiple choice (three-tier)
    options: Optional[dict[Option, str]] = None
    correct: Optional[Option] = None
    distractor_map: Optional[dict[Option, str]] = None
    reasons: Optional[dict[ReasonId, Reason]] = None
    # short free-text answer
    answer_key: str = ""
    expected_reasoning: str = ""
    accept_any: list[str] = []
    reasoning_any: list[str] = []
    numeric: Optional[Numeric] = None
    patterns: list[Pattern] = []
    follow_ups: dict[str, str] = {}

    @model_validator(mode="after")
    def _check(self) -> "Item":
        if self.kind == "short":
            if not self.answer_key or not (self.accept_any or self.numeric):
                raise ValueError(f"{self.item_id}: short items need answer_key and accept_any or numeric")
            return self
        if not (self.options and self.correct and self.distractor_map and self.reasons):
            raise ValueError(f"{self.item_id}: mcq items need options, correct, distractor_map and reasons")
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

    def codes(self) -> set[str]:
        """Every code this item can surface."""
        if self.kind == "short":
            return {p.code for p in self.patterns}
        return set(self.distractor_map.values()) | {r.maps_to for r in self.reasons.values()}

    def public(self) -> dict:
        """What the learner sees: never the answer key."""
        out = {"item_id": self.item_id, "concept": self.concept, "kind": self.kind, "stem": self.stem, "transfer": self.transfer}
        if self.kind == "mcq":
            out["options"] = self.options
            out["reasons"] = {rid: r.text for rid, r in self.reasons.items()}
        return out


class Equation(BaseModel):
    expr: str
    meaning: str = ""
    vars: dict[str, str] = {}
    assumptions: str = ""


class Misconception(BaseModel):
    code: str
    concept: str
    description: str
    exemplars: list[str] = []  # 12 required for real content; enforced by scripts/validate_content.py
    remediation_card_id: str
    followup_item_ids: list[str]
    contrast_probe: str
    verify_flags: list[str] = []


class Card(BaseModel):
    """Concept cards (<concept>-K) and remediation cards (<code>-R) share one shape."""
    card_id: str
    concept: str
    code: Optional[str] = None
    statement: str
    # concept-card lesson fields
    topic: str = ""
    subtopic: str = ""
    learning_objective: str = ""
    simple: str = ""
    formal: str = ""
    equations: list[Equation] = []
    analogy: str = ""
    steps: list[str] = []
    worked_example: str = ""
    alternatives: list[str] = []
    visual: str = ""
    source: str = ""
    # remediation-card fields
    wrong_idea: str = ""
    why_it_feels_right: str = ""
    why_wrong: str = ""
    sim_moment: str = ""
    verify_flags: list[str] = []


class Content(BaseModel):
    topics: list[Topic]
    concepts: list[Concept]
    misconceptions: dict[str, Misconception]
    items: dict[str, Item]
    cards: dict[str, Card]

    def concept(self, concept_id: str) -> Concept:
        return next(c for c in self.concepts if c.concept_id == concept_id)

    @model_validator(mode="after")
    def _cross_check(self) -> "Content":
        concept_ids = {c.concept_id for c in self.concepts}
        codes = set(self.misconceptions)
        errors = []
        for i in self.items.values():
            if i.concept not in concept_ids:
                errors.append(f"{i.item_id}: unknown concept {i.concept}")
            if i.kind == "mcq":
                for c in i.distractor_map.values():
                    if c not in codes | {CORRECT, SLIP, UNMAPPED}:
                        errors.append(f"{i.item_id}: unknown option code {c}")
                for r in i.reasons.values():
                    if r.maps_to not in codes | {CORRECT}:
                        errors.append(f"{i.item_id}: reasons may map only to 'CORRECT' or a code, got {r.maps_to}")
            errors += [f"{i.item_id}: unknown pattern code {p.code}" for p in i.patterns if p.code not in codes]
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
        topics=_read("topics.json"),
        concepts=_read("concepts.json"),
        misconceptions=_read("misconceptions.json", "code"),
        items=_read("items.json", "item_id"),
        cards=_read("cards.json", "card_id"),
    )
