"""SQLite persistence. apply_response() is the ONLY function that writes the mastery table."""
from __future__ import annotations

import json
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Session, SQLModel, create_engine, func, select

from api import engine as eng
from api.content import DATA_DIR, load_content
from api.engine.grading import CORRECT_CATEGORIES, FALSE_POSITIVE, MISCONCEPTION, NOT_COUNTED

DB_URL = os.environ.get("WAVELOOP_DB", f"sqlite:///{DATA_DIR / 'learnloop.db'}")
db = create_engine(DB_URL, connect_args={"check_same_thread": False})

DEMO_LEARNERS = {"asha": "Asha (demo)", "ben": "Ben (demo)"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Learner(SQLModel, table=True):
    __tablename__ = "learners"
    id: str = Field(primary_key=True)
    name: str
    is_demo: bool = False
    created_at: datetime = Field(default_factory=_now)


class Response(SQLModel, table=True):
    """What the learner submitted, unchanged."""
    __tablename__ = "responses"
    id: Optional[int] = Field(default=None, primary_key=True)
    learner_id: str = Field(foreign_key="learners.id", index=True)
    item_id: str
    concept: str = Field(index=True)
    kind: str = "mcq"
    option: Optional[str] = None
    reason_id: Optional[str] = None
    reason_text: Optional[str] = None
    answer_text: Optional[str] = None
    confidence: str = "sure"
    created_at: datetime = Field(default_factory=_now)


class Diagnosis(SQLModel, table=True):
    """What the rules decided about one response (1:1, keyed by response_id)."""
    __tablename__ = "diagnoses"
    response_id: int = Field(foreign_key="responses.id", primary_key=True)
    category: str
    rule_fired: str
    engine: str = "rules"
    option_code: Optional[str] = None
    reason_code: Optional[str] = None
    misconception_code: Optional[str] = None
    classifier_score: Optional[float] = None  # heuristic confidence; evidence only
    evidence: str = "[]"  # JSON list of learner-facing lines
    follow_up: str = "null"  # JSON FollowUp
    pipeline: str = "[]"  # JSON trace of the three orchestrator stages
    visual: str = "null"  # JSON overlay spec from the visual-correction stage
    clarifications: int = 0
    # Set only by apply_response():
    applied_seq: Optional[int] = None
    p_after: Optional[float] = None


class StepPick(SQLModel, table=True):
    """The step where a learner says their working went wrong. Self-report only: never changes mastery."""
    __tablename__ = "step_picks"
    response_id: int = Field(foreign_key="responses.id", primary_key=True)
    step: int


class Mastery(SQLModel, table=True):
    __tablename__ = "mastery"
    learner_id: str = Field(foreign_key="learners.id", primary_key=True)
    concept: str = Field(primary_key=True)
    p_learned: float = eng.P_L0
    attempts: int = 0
    distinct_items: int = 0
    last_correct: bool = False
    updated_at: datetime = Field(default_factory=_now)


class AssessmentSession(SQLModel, table=True):
    __tablename__ = "assessment_sessions"
    id: Optional[int] = Field(default=None, primary_key=True)
    learner_id: str = Field(foreign_key="learners.id", index=True)
    kind: str  # "pre" | "post"
    started_at: datetime = Field(default_factory=_now)
    completed_at: Optional[datetime] = None
    total: int = 0
    correct: int = 0
    score_percentage: Optional[float] = None


class Assessment(SQLModel, table=True):
    """One pre/post answer. Never touches mastery; never shown back with its key."""
    __tablename__ = "assessments"
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="assessment_sessions.id", index=True)
    learner_id: str = Field(foreign_key="learners.id", index=True)
    item_id: str
    option: Optional[str] = None
    reason_id: Optional[str] = None
    answer_text: Optional[str] = None
    answer_correct: bool
    reason_correct: bool
    category: str
    misconception_code: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)


class Dialogue(SQLModel, table=True):
    """A Socratic dialogue: a confused classmate holds one misconception; the student tries to convince them."""
    __tablename__ = "dialogues"
    id: Optional[int] = Field(default=None, primary_key=True)
    learner_id: str = Field(foreign_key="learners.id", index=True)
    concept: str
    code: str  # the misconception the peer holds
    item_id: str  # short-answer item whose key and patterns judge the student's replies
    persona: str = "peer"
    status: str = "open"  # open | resolved | unresolved
    student_turns: int = 0
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class DialogueTurn(SQLModel, table=True):
    __tablename__ = "dialogue_turns"
    id: Optional[int] = Field(default=None, primary_key=True)
    dialogue_id: int = Field(foreign_key="dialogues.id", index=True)
    role: str  # peer | student
    text: str
    engine: str = "rules"  # who wrote a peer line (rules script or claude); who judged a student line
    category: Optional[str] = None  # student turns: orchestrator result
    misconception_code: Optional[str] = None  # student turns: flagged faulty idea, if any
    evidence: str = "[]"
    pipeline: str = "[]"
    created_at: datetime = Field(default_factory=_now)


def init_db() -> None:
    SQLModel.metadata.create_all(db)


def ensure_learner(session: Session, learner_id: str) -> Learner:
    learner = session.get(Learner, learner_id)
    if learner is None:
        learner = Learner(id=learner_id, name=DEMO_LEARNERS.get(learner_id, "Learner"), is_demo=learner_id in DEMO_LEARNERS)
        session.add(learner)
        session.commit()
    return learner


def create_learner(session: Session) -> Learner:
    learner = Learner(id=f"anon-{secrets.token_hex(4)}", name="Learner")
    session.add(learner)
    session.commit()
    session.refresh(learner)
    return learner


def reset_learner(session: Session, learner_id: str) -> int:
    """Delete every record of one learner (used for demo learners only)."""
    rows = session.exec(select(Response).where(Response.learner_id == learner_id)).all()
    for r in rows:
        for row in (session.get(Diagnosis, r.id), session.get(StepPick, r.id)):
            if row:
                session.delete(row)
    session.commit()
    for dlg in session.exec(select(Dialogue).where(Dialogue.learner_id == learner_id)).all():
        for t in session.exec(select(DialogueTurn).where(DialogueTurn.dialogue_id == dlg.id)).all():
            session.delete(t)
        session.delete(dlg)
    session.commit()
    for model in (Response, Assessment, AssessmentSession, Mastery):
        for row in session.exec(select(model).where(model.learner_id == learner_id)).all():
            session.delete(row)
    session.commit()
    return len(rows)


def current_p(session: Session, learner_id: str, concept: str) -> float:
    m = session.get(Mastery, (learner_id, concept))
    return m.p_learned if m else eng.P_L0


def apply_response(session: Session, response_id: int) -> Optional[float]:
    """The single mastery writer. Idempotent. Categories without trustworthy evidence never count."""
    d = session.get(Diagnosis, response_id)
    if d is None or d.category in NOT_COUNTED:
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
        select(Diagnosis.misconception_code, Response.item_id, Diagnosis.classifier_score, Diagnosis.engine)
        .join(Response)
        .where(Response.learner_id == learner_id, Diagnosis.category.in_([MISCONCEPTION, FALSE_POSITIVE]))
    ).all()
    evidence: dict[str, list[tuple[str, Optional[float]]]] = {}
    for code, item_id, score, engine in rows:
        # Only a classifier (LLM) score counts toward "1 item + classifier match >= 0.75".
        evidence.setdefault(code, []).append((item_id, score if engine == "llm" else None))
    return {code: eng.misconception_status(ev) for code, ev in evidence.items()}


def attempts(session: Session, learner_id: str, concept: Optional[str] = None, limit: Optional[int] = None) -> list[dict]:
    content = load_content()
    q = select(Response, Diagnosis).join(Diagnosis).where(Response.learner_id == learner_id)
    if concept:
        q = q.where(Response.concept == concept)
    rows = session.exec(q.order_by(Response.id)).all()
    seen: set[str] = set()
    out = []
    for r, d in rows:
        item = content.items.get(r.item_id)
        if r.kind == "short":
            answer = r.answer_text or ""
        else:
            answer = f"{r.option}: {item.options[r.option]}" if item and item.options else f"Option {r.option}"
            if r.reason_id and item and item.reasons:
                why = item.reasons[r.reason_id].text
                answer += f", because {why[:1].lower()}{why[1:]}"
            elif r.reason_text:
                answer += f", “{r.reason_text}”"
        out.append({
            "response_id": r.id, "item_id": r.item_id, "concept": r.concept, "kind": r.kind, "answer": answer,
            "category": d.category, "group": eng.grading.GROUP[d.category], "misconception_code": d.misconception_code,
            "confidence": d.classifier_score, "engine": d.engine, "transfer": bool(item and item.transfer),
            "novel": r.item_id not in seen, "counted": d.applied_seq is not None, "p_after": d.p_after,
            "created_at": r.created_at.isoformat(),
        })
        seen.add(r.item_id)
    return out[-limit:] if limit else out


def _transfer_correct(session: Session, learner_id: str, concept: str) -> bool:
    content = load_content()
    rows = session.exec(
        select(Response.item_id, Diagnosis.category).join(Diagnosis)
        .where(Response.learner_id == learner_id, Response.concept == concept)
    ).all()
    return any(content.items[i].transfer and c in CORRECT_CATEGORIES for i, c in rows if i in content.items)


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
        confirmed = sorted(k for k, s in concept_mc.items() if s == "CONFIRMED")
        transfer = _transfer_correct(session, learner_id, c.concept_id)
        status, reason, enough = eng.mastery_status(m.p_learned, m.attempts, m.distinct_items, m.last_correct, transfer, confirmed)
        out.append({
            "concept": c.concept_id,
            "status": status,
            "status_reason": reason,
            "enough_evidence": enough,
            "p_learned": round(m.p_learned, 4),
            "attempts": m.attempts,
            "distinct_items": m.distinct_items,
            "transfer_correct": transfer,
            "last_correct": m.last_correct,
            "mastered": status == "demonstrated",
            "misconceptions": concept_mc,
            "history": [round(p, 4) for p in history],
        })
    return out


def pending_slip(session: Session, learner_id: str) -> Optional[tuple[str, Optional[str]]]:
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
    return slip[1] if slip and slip[1] and eng.is_sibling(items[slip[0]], items[item_id]) else None


def tries(session: Session, learner_id: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for item_id in session.exec(select(Response.item_id).where(Response.learner_id == learner_id)).all():
        out[item_id] = out.get(item_id, 0) + 1
    return out


def sibling_for(session: Session, learner_id: str, item_id: str) -> Optional[str]:
    content = load_content()
    tried = tries(session, learner_id)
    src = content.items[item_id]
    sibs = [i for i in content.items.values() if not i.is_assessment and eng.is_sibling(src, i)]
    return min(sibs, key=lambda i: tried.get(i.item_id, 0)).item_id if sibs else None


def next_item(session: Session, learner_id: str, concept: Optional[str] = None, kind: Optional[str] = None) -> Optional[str]:
    """Slip rule 5 sibling first; else the least-tried practice item of `concept` if given (the learner chose it),
    or of the first concept not yet demonstrated."""
    content = load_content()
    tried = tries(session, learner_id)

    slip = pending_slip(session, learner_id)
    if slip and concept in (None, content.items[slip[0]].concept) and kind in (None, "mcq"):
        sib = sibling_for(session, learner_id, slip[0])
        if sib:
            return sib

    def pick(cid: str) -> Optional[str]:
        pool = [i for i in content.items.values() if i.concept == cid and not i.is_assessment and kind in (None, i.kind)]
        return min(pool, key=lambda i: tried.get(i.item_id, 0)).item_id if pool else None

    if concept:
        return pick(concept)
    for m in mastery(session, learner_id):
        if m["status"] != "demonstrated":
            return pick(m["concept"])
    return None


def dump(value) -> str:
    return json.dumps(value, ensure_ascii=False)
