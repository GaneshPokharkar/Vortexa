"""SQLite persistence. apply_response() is the ONLY function that writes mastery."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Session, SQLModel, create_engine, func, select

from api import engine as eng
from api.content import DATA_DIR, load_content
from api.engine.grading import FALSE_POSITIVE, MISCONCEPTION

DB_URL = os.environ.get("WAVELOOP_DB", f"sqlite:///{DATA_DIR / 'waveloop.db'}")
db = create_engine(DB_URL, connect_args={"check_same_thread": False})


class Response(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    learner_id: str = Field(index=True)
    item_id: str
    concept: str = Field(index=True)
    option: str
    reason_id: Optional[str] = None
    reason_text: Optional[str] = None
    confidence: str
    category: str
    rule: str
    option_code: str
    reason_code: Optional[str] = None
    misconception_code: Optional[str] = None
    classifier_score: Optional[float] = None  # filled by the classifier later; evidence only
    clarifications: int = 0
    # Mastery fields: written only by apply_response().
    applied_seq: Optional[int] = None
    p_after: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def init_db() -> None:
    SQLModel.metadata.create_all(db)


def current_p(session: Session, learner_id: str, concept: str) -> float:
    last = session.exec(
        select(Response.p_after)
        .where(Response.learner_id == learner_id, Response.concept == concept, Response.applied_seq != None)  # noqa: E711
        .order_by(Response.applied_seq.desc())
    ).first()
    return eng.P_L0 if last is None else last


def apply_response(session: Session, response_id: int) -> Optional[float]:
    """The single mastery writer. Idempotent. AMBIGUOUS waits for clarification; UNDIAGNOSED never counts."""
    r = session.get(Response, response_id)
    if r is None or r.category in (eng.grading.AMBIGUOUS, eng.grading.UNDIAGNOSED):
        return None
    if r.applied_seq is not None:
        return r.p_after
    correct = r.category in eng.grading.CORRECT_CATEGORIES
    r.p_after = eng.bkt_update(current_p(session, r.learner_id, r.concept), correct)
    r.applied_seq = (session.exec(select(func.max(Response.applied_seq))).one() or 0) + 1
    session.add(r)
    session.commit()
    return r.p_after


def misconception_statuses(session: Session, learner_id: str) -> dict[str, str]:
    rows = session.exec(
        select(Response).where(
            Response.learner_id == learner_id,
            Response.misconception_code != None,  # noqa: E711
            Response.category.in_([MISCONCEPTION, FALSE_POSITIVE]),
        )
    ).all()
    evidence: dict[str, list[tuple[str, Optional[float]]]] = {}
    for r in rows:
        evidence.setdefault(r.misconception_code, []).append((r.item_id, r.classifier_score))
    return {code: eng.misconception_status(ev) for code, ev in evidence.items()}


def mastery(session: Session, learner_id: str) -> list[dict]:
    content = load_content()
    statuses = misconception_statuses(session, learner_id)
    out = []
    for c in content.concepts:
        applied = session.exec(
            select(Response)
            .where(Response.learner_id == learner_id, Response.concept == c.concept_id, Response.applied_seq != None)  # noqa: E711
            .order_by(Response.applied_seq)
        ).all()
        p = applied[-1].p_after if applied else eng.P_L0
        last_correct = bool(applied) and applied[-1].category in eng.grading.CORRECT_CATEGORIES
        concept_mc = {
            code: s for code, s in statuses.items() if content.misconceptions[code].concept == c.concept_id
        }
        distinct = len({r.item_id for r in applied})
        out.append({
            "concept": c.concept_id,
            "p_learned": round(p, 4),
            "attempts": len(applied),
            "distinct_items": distinct,
            "last_correct": last_correct,
            "mastered": eng.is_mastered(p, len(applied), distinct, last_correct, "CONFIRMED" in concept_mc.values()),
            "misconceptions": concept_mc,
            "history": [round(r.p_after, 4) for r in applied],
        })
    return out


def next_item(session: Session, learner_id: str) -> Optional[str]:
    """Pending sibling after a slip first; else the first unmastered concept's least-tried practice item."""
    content = load_content()
    last = session.exec(
        select(Response).where(Response.learner_id == learner_id).order_by(Response.id.desc())
    ).first()
    if last and last.category in eng.grading.SLIP_CATEGORIES:
        src = content.items[last.item_id]
        for i in content.items.values():
            if not i.is_assessment and i.item_id != src.item_id and (
                i.sibling_of == src.item_id or src.sibling_of == i.item_id
            ):
                return i.item_id

    tries: dict[str, int] = {}
    for item_id in session.exec(select(Response.item_id).where(Response.learner_id == learner_id)).all():
        tries[item_id] = tries.get(item_id, 0) + 1
    for m in mastery(session, learner_id):
        if m["mastered"]:
            continue
        pool = [i for i in content.items.values() if i.concept == m["concept"] and not i.is_assessment]
        if pool:
            return min(pool, key=lambda i: tries.get(i.item_id, 0)).item_id
    return None
