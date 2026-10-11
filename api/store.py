"""SQLite persistence. apply_response() is the ONLY function that writes the mastery table."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Session, SQLModel, create_engine, func, select

from api import engine as eng
from api.content import DATA_DIR, load_content
from api.engine.grading import AMBIGUOUS, CORRECT_CATEGORIES, FALSE_POSITIVE, MISCONCEPTION, UNDIAGNOSED

DB_URL = os.environ.get("WAVELOOP_DB", f"sqlite:///{DATA_DIR / 'waveloop.db'}")
db = create_engine(DB_URL, connect_args={"check_same_thread": False})


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Learner(SQLModel, table=True):
    __tablename__ = "learners"
    id: str = Field(primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=_now)


class Response(SQLModel, table=True):
    """What the learner submitted, unchanged."""
    __tablename__ = "responses"
    id: Optional[int] = Field(default=None, primary_key=True)
    learner_id: str = Field(foreign_key="learners.id", index=True)
    item_id: str
    concept: str = Field(index=True)
    option: str
    reason_id: Optional[str] = None
    reason_text: Optional[str] = None
    confidence: str
    created_at: datetime = Field(default_factory=_now)


class Diagnosis(SQLModel, table=True):
    """What the rules decided about one response (1:1, keyed by response_id)."""
    __tablename__ = "diagnoses"
    response_id: int = Field(foreign_key="responses.id", primary_key=True)
    category: str
    rule_fired: str
    option_code: str
    reason_code: Optional[str] = None
    misconception_code: Optional[str] = None
    classifier_score: Optional[float] = None  # evidence only, filled by the classifier phase
    clarifications: int = 0
    # Set only by apply_response():
    applied_seq: Optional[int] = None
    p_after: Optional[float] = None


class Mastery(SQLModel, table=True):
    __tablename__ = "mastery"
    learner_id: str = Field(foreign_key="learners.id", primary_key=True)
    concept: str = Field(primary_key=True)
    p_learned: float = eng.P_L0
    attempts: int = 0
    distinct_items: int = 0
    last_correct: bool = False
    updated_at: datetime = Field(default_factory=_now)


class Assessment(SQLModel, table=True):
    """Pre/post test answers. Never touches mastery."""
    __tablename__ = "assessments"
    id: Optional[int] = Field(default=None, primary_key=True)
    learner_id: str = Field(foreign_key="learners.id", index=True)
    form: str  # "pre" | "post"
    item_id: str
    option: str
    reason_id: Optional[str] = None
    confidence: str
    answer_correct: bool
    reason_correct: bool
    created_at: datetime = Field(default_factory=_now)


def init_db() -> None:
    SQLModel.metadata.create_all(db)


def ensure_learner(session: Session, learner_id: str) -> None:
    if session.get(Learner, learner_id) is None:
        session.add(Learner(id=learner_id, name=learner_id.title()))
        session.commit()


def current_p(session: Session, learner_id: str, concept: str) -> float:
    m = session.get(Mastery, (learner_id, concept))
    return m.p_learned if m else eng.P_L0


def apply_response(session: Session, response_id: int) -> Optional[float]:
    """The single mastery writer. Idempotent. AMBIGUOUS waits for clarification; UNDIAGNOSED never counts."""
    d = session.get(Diagnosis, response_id)
    if d is None or d.category in (AMBIGUOUS, UNDIAGNOSED):
        return None
    if d.applied_seq is not None:
        return d.p_after
    r = session.get(Response, response_id)
    m = session.get(Mastery, (r.learner_id, r.concept)) or Mastery(learner_id=r.learner_id, concept=r.concept)
    correct = d.category in CORRECT_CATEGORIES
    d.p_after = eng.bkt_update(m.p_learned, correct)
    d.applied_seq = (session.exec(select(func.max(Diagnosis.applied_seq))).one() or 0) + 1
    seen = set(session.exec(
        select(Response.item_id).join(Diagnosis)
        .where(Response.learner_id == r.learner_id, Response.concept == r.concept, Diagnosis.applied_seq != None)  # noqa: E711
    ).all())
    m.p_learned, m.attempts, m.last_correct = d.p_after, m.attempts + 1, correct
    m.distinct_items, m.updated_at = len(seen | {r.item_id}), _now()
    session.add_all([d, m])
    session.commit()
    return d.p_after


def misconception_statuses(session: Session, learner_id: str) -> dict[str, str]:
    rows = session.exec(
        select(Diagnosis.misconception_code, Response.item_id, Diagnosis.classifier_score)
        .join(Response)
        .where(Response.learner_id == learner_id, Diagnosis.category.in_([MISCONCEPTION, FALSE_POSITIVE]))
    ).all()
    evidence: dict[str, list[tuple[str, Optional[float]]]] = {}
    for code, item_id, score in rows:
        evidence.setdefault(code, []).append((item_id, score))
    return {code: eng.misconception_status(ev) for code, ev in evidence.items()}


def mastery(session: Session, learner_id: str) -> list[dict]:
    content = load_content()
    statuses = misconception_statuses(session, learner_id)
    out = []
    for c in content.concepts:
        m = session.get(Mastery, (learner_id, c.concept_id)) or Mastery(learner_id=learner_id, concept=c.concept_id)
        history = session.exec(
            select(Diagnosis.p_after).join(Response)
            .where(Response.learner_id == learner_id, Response.concept == c.concept_id, Diagnosis.applied_seq != None)  # noqa: E711
            .order_by(Diagnosis.applied_seq)
        ).all()
        concept_mc = {code: s for code, s in statuses.items() if content.misconceptions[code].concept == c.concept_id}
        out.append({
            "concept": c.concept_id,
            "p_learned": round(m.p_learned, 4),
            "attempts": m.attempts,
            "distinct_items": m.distinct_items,
            "last_correct": m.last_correct,
            "mastered": eng.is_mastered(
                m.p_learned, m.attempts, m.distinct_items, m.last_correct, "CONFIRMED" in concept_mc.values()
            ),
            "misconceptions": concept_mc,
            "history": [round(p, 4) for p in history],
        })
    return out


def pending_slip(session: Session, learner_id: str) -> Optional[tuple[str, str]]:
    """(item_id, option_code) of the learner's latest response if it was a slip, else None."""
    row = session.exec(
        select(Response.item_id, Diagnosis.option_code, Diagnosis.category)
        .join(Diagnosis).where(Response.learner_id == learner_id).order_by(Response.id.desc())
    ).first()
    if row and row[2] in eng.grading.SLIP_CATEGORIES:
        return row[0], row[1]
    return None


def prior_slip_code(session: Session, learner_id: str, item_id: str) -> Optional[str]:
    """Option code of the slip that scheduled this item as its sibling (input to slip rule 5)."""
    slip = pending_slip(session, learner_id)
    items = load_content().items
    return slip[1] if slip and eng.is_sibling(items[slip[0]], items[item_id]) else None


def next_item(session: Session, learner_id: str, concept: Optional[str] = None) -> Optional[str]:
    """Slip rule 5 sibling first; else the least-tried practice item of `concept` if given (the learner
    chose it), or of the first unmastered concept."""
    content = load_content()
    tries: dict[str, int] = {}
    for item_id in session.exec(select(Response.item_id).where(Response.learner_id == learner_id)).all():
        tries[item_id] = tries.get(item_id, 0) + 1

    slip = pending_slip(session, learner_id)
    if slip:
        src = content.items[slip[0]]
        sibs = [i for i in content.items.values() if not i.is_assessment and eng.is_sibling(src, i)]
        if sibs and concept in (None, src.concept):
            return min(sibs, key=lambda i: tries.get(i.item_id, 0)).item_id

    if concept:
        pool = [i for i in content.items.values() if i.concept == concept and not i.is_assessment]
        return min(pool, key=lambda i: tries.get(i.item_id, 0)).item_id if pool else None
    for m in mastery(session, learner_id):
        if m["mastered"]:
            continue
        pool = [i for i in content.items.values() if i.concept == m["concept"] and not i.is_assessment]
        if pool:
            return min(pool, key=lambda i: tries.get(i.item_id, 0)).item_id
    return None
