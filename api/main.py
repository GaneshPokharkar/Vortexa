"""LearnLoop AI backend. Run: uvicorn api.main:app --reload"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")  # before anything reads provider keys

from fastapi import Depends, FastAPI, Header, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
from sqlmodel import Session, select  # noqa: E402

from api import engine as eng  # noqa: E402
from api import reports, tutor  # noqa: E402
from api.ai import llm, voice  # noqa: E402
from api.content import Item, Option, ReasonId, load_content  # noqa: E402
from api.engine.grading import GROUP, GROUP_LABEL  # noqa: E402
from api.store import (  # noqa: E402
    DEMO_LEARNERS, AssessmentSession, Diagnosis, Learner, Response, attempts, create_learner, db, ensure_learner,
    init_db, mastery, misconception_statuses, next_item, reset_learner,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_content()  # fail fast on invalid data files
    init_db()
    yield


app = FastAPI(title="LearnLoop AI", lifespan=lifespan)


def get_session():
    with Session(db) as s:
        yield s


def _item(item_id: str) -> Item:
    item = load_content().items.get(item_id)
    if item is None:
        raise HTTPException(404, f"Unknown question {item_id}.")
    return item


def _mastery_row(session: Session, learner_id: str, concept: str) -> dict:
    return next(m for m in mastery(session, learner_id) if m["concept"] == concept)


# ---------------- status ----------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/modes")
def modes():
    return {"llm": llm.status(), "voice": voice.status()}


# ---------------- learners ----------------

@app.post("/learners")
def new_learner(session: Session = Depends(get_session)):
    lr = create_learner(session)
    return {"learner_id": lr.id, "display_name": lr.name, "is_demo": False}


@app.get("/learners/demo")
def demo_learners(session: Session = Depends(get_session)):
    return [{"learner_id": k, "display_name": v, "is_demo": True} for k, v in DEMO_LEARNERS.items()]


class ResetIn(BaseModel):
    learner_id: str


@app.post("/demo/reset")
def demo_reset(body: ResetIn, session: Session = Depends(get_session)):
    if body.learner_id not in DEMO_LEARNERS:
        raise HTTPException(403, "Only demo learners can be cleared from the app.")
    return {"cleared": reset_learner(session, body.learner_id)}


# ---------------- curriculum ----------------

@app.get("/topics")
def topics():
    c = load_content()
    return [{**t.model_dump(), "concepts": [x.concept_id for x in c.concepts if x.topic_id == t.topic_id]} for t in c.topics]


@app.get("/concepts")
def concepts():
    return [c.public() for c in load_content().concepts]


@app.get("/concepts/{concept_id}/lesson")
def lesson(concept_id: str, learner_id: Optional[str] = None, session: Session = Depends(get_session)):
    c = load_content()
    if concept_id not in {x.concept_id for x in c.concepts}:
        raise HTTPException(404, f"Unknown concept {concept_id}.")
    concept = c.concept(concept_id)
    mode, why = tutor.suggested_mode(session, learner_id, concept_id)
    return {
        "concept": concept.public(),
        "card": c.cards[f"{concept_id}-K"],
        "misconceptions": [{"code": m.code, "description": m.description, "remediation_card_id": m.remediation_card_id}
                           for m in c.misconceptions.values() if m.concept == concept_id],
        "doubts": concept.doubts,
        "suggested_mode": mode,
        "mode_reason": why,
    }


@app.get("/explain/{card_id}")
def explain(card_id: str):
    card = load_content().cards.get(card_id)
    if card is None:
        raise HTTPException(404, f"Unknown card {card_id}.")
    return card


# ---------------- practice & diagnosis ----------------

@app.get("/items/next")
def items_next(learner_id: str, concept: Optional[str] = None, kind: Optional[Literal["mcq", "short"]] = None,
               session: Session = Depends(get_session)):
    item_id = next_item(session, learner_id, concept, kind)
    return {"item": load_content().items[item_id].public() if item_id else None}


@app.get("/items/{item_id}")
def get_item(item_id: str):
    item = _item(item_id)
    if item.is_assessment:
        raise HTTPException(404, "Assessment questions are only shown inside an assessment.")
    return item.public()


class ResponseIn(BaseModel):
    learner_id: str = Field(min_length=1, max_length=64)
    item_id: str
    confidence: Optional[Literal["sure", "unsure"]] = None
    option: Optional[Option] = None
    reason_id: Optional[ReasonId] = None
    reason_text: Optional[str] = Field(default=None, max_length=1000)
    answer_text: Optional[str] = Field(default=None, max_length=1000)


@app.post("/responses")
def post_response(body: ResponseIn, session: Session = Depends(get_session)):
    item = _item(body.item_id)
    if item.is_assessment:
        raise HTTPException(409, "Assessment questions are answered inside the assessment.")
    if item.kind == "mcq":
        if not body.option or not body.confidence:
            raise HTTPException(422, "Choose an answer and say how sure you are.")
        if not body.reason_id and not (body.reason_text or "").strip():
            raise HTTPException(422, "Pick a reason or explain in your own words.")
    elif not (body.answer_text or "").strip():
        raise HTTPException(422, "Type or say an answer first.")
    ensure_learner(session, body.learner_id)
    r, d = tutor.diagnose(session, item, body.learner_id, option=body.option, reason_id=body.reason_id,
                          reason_text=body.reason_text, answer_text=body.answer_text,
                          confidence=body.confidence or "sure")
    return tutor.feedback(session, r, d, _mastery_row(session, r.learner_id, r.concept))


class ClarifyIn(BaseModel):
    response_id: int
    reason_id: Optional[ReasonId] = None
    text: Optional[str] = Field(default=None, max_length=1000)


@app.post("/clarify")
def clarify(body: ClarifyIn, session: Session = Depends(get_session)):
    r, d = session.get(Response, body.response_id), session.get(Diagnosis, body.response_id)
    if r is None or d is None:
        raise HTTPException(404, "Unknown response.")
    if d.category not in tutor.CLARIFIABLE:
        raise HTTPException(409, f"This answer is already diagnosed ({d.category}).")
    if not body.reason_id and not (body.text or "").strip():
        raise HTTPException(422, "Pick a reason or type a reply.")
    tutor.clarify(session, r, d, reason_id=body.reason_id, text=body.text)
    return tutor.feedback(session, r, d, _mastery_row(session, r.learner_id, r.concept))


@app.get("/diagnosis/{response_id}/why")
def why(response_id: int, session: Session = Depends(get_session)):
    r, d = session.get(Response, response_id), session.get(Diagnosis, response_id)
    if r is None or d is None:
        raise HTTPException(404, "Unknown response.")
    item = _item(r.item_id)
    import json
    return {
        "response_id": r.id,
        "item_id": r.item_id,
        "category": d.category,
        "group": GROUP[d.category],
        "group_label": GROUP_LABEL[GROUP[d.category]],
        "rule_fired": d.rule_fired,
        "rule_text": eng.RULES[d.rule_fired],
        "engine": d.engine,
        "evidence": json.loads(d.evidence),
        "distractor_map_entry": {r.option: item.distractor_map[r.option]} if item.kind == "mcq" else None,
        "reason": {"reason_id": r.reason_id, "maps_to": d.reason_code} if r.reason_id else None,
        "reason_text": r.reason_text or r.answer_text,
        "classifier_confidence": d.classifier_score,
        "clarifications": d.clarifications,
        "misconception_status": misconception_statuses(session, r.learner_id).get(d.misconception_code or ""),
    }


# ---------------- mastery ----------------

@app.get("/mastery/{learner_id}")
def get_mastery(learner_id: str, session: Session = Depends(get_session)):
    return {"learner_id": learner_id, "concepts": mastery(session, learner_id)}


@app.get("/mastery/{learner_id}/{concept_id}/history")
def history(learner_id: str, concept_id: str, session: Session = Depends(get_session)):
    row = next((m for m in mastery(session, learner_id) if m["concept"] == concept_id), None)
    if row is None:
        raise HTTPException(404, f"Unknown concept {concept_id}.")
    tries = attempts(session, learner_id, concept_id)
    counted = [a for a in tries if a["counted"]]
    reasons = [row["status_reason"],
               f"{len(counted)} of {len(tries)} answers counted as evidence; unclear or off-topic answers never count.",
               "Typing that you understand never changes this status; only answered questions do."]
    return {**row, "reasons": reasons, "attempts": tries}


# ---------------- assessment & report ----------------

class StartIn(BaseModel):
    learner_id: str = Field(min_length=1, max_length=64)
    kind: Literal["pre", "post"]


class AssessAnswerIn(BaseModel):
    item_id: str
    option: Optional[Option] = None
    reason_id: Optional[ReasonId] = None
    answer_text: Optional[str] = Field(default=None, max_length=1000)
    confidence: Optional[Literal["sure", "unsure"]] = None  # accepted for symmetry, not scored


def _session(session: Session, session_id: int) -> AssessmentSession:
    s = session.get(AssessmentSession, session_id)
    if s is None:
        raise HTTPException(404, "Unknown assessment.")
    return s


@app.post("/assessments")
def start_assessment(body: StartIn, session: Session = Depends(get_session)):
    ensure_learner(session, body.learner_id)
    try:
        s = reports.start(session, body.learner_id, body.kind)
    except reports.AssessmentError as e:
        raise HTTPException(409, str(e))
    return reports.session_payload(session, s)


@app.post("/assessments/{session_id}/answers")
def answer_assessment(session_id: int, body: AssessAnswerIn, session: Session = Depends(get_session)):
    try:
        return reports.answer(session, _session(session, session_id), body.item_id, option=body.option,
                              reason_id=body.reason_id, answer_text=body.answer_text)
    except reports.AssessmentError as e:
        raise HTTPException(409, str(e))


@app.post("/assessments/{session_id}/complete")
def complete_assessment(session_id: int, session: Session = Depends(get_session)):
    try:
        return reports.complete(session, _session(session, session_id))
    except reports.AssessmentError as e:
        raise HTTPException(409, str(e))


@app.get("/report")
def report(include_demo: bool = False, session: Session = Depends(get_session)):
    return reports.class_report(session, include_demo)


@app.get("/report/learner/{learner_id}")
def learner_report(learner_id: str, session: Session = Depends(get_session)):
    return reports.learner_report(session, learner_id)


# ---------------- self-learning ----------------

@app.get("/recommendations/{learner_id}")
def recommendations(learner_id: str, session: Session = Depends(get_session)):
    return reports.recommendations(session, learner_id)


@app.get("/doubts")
def doubts(q: Optional[str] = None, concept: Optional[str] = None, session: Session = Depends(get_session)):
    return reports.doubts(session, q, concept)


class AskIn(BaseModel):
    learner_id: str = Field(min_length=1, max_length=64)
    concept: str
    question: str = Field(min_length=3, max_length=500)


@app.post("/tutor/ask")
def ask(body: AskIn):
    if body.concept not in {c.concept_id for c in load_content().concepts}:
        raise HTTPException(404, f"Unknown concept {body.concept}.")
    return tutor.ask(body.concept, body.question)


# ---------------- voice ----------------

@app.get("/voice/session")
def voice_session(learner_id: str, concept: Optional[str] = None):
    return voice.signed_url()


# ---------------- teacher review ----------------

@app.get("/review")
def review(x_reviewer_token: Optional[str] = Header(default=None)):
    expected = os.environ.get("LEARNLOOP_REVIEWER_TOKEN")
    if not expected:
        raise HTTPException(503, "Teacher review is off. Set LEARNLOOP_REVIEWER_TOKEN in api/.env.")
    if x_reviewer_token != expected:
        raise HTTPException(401, "Wrong reviewer token.")
    c = load_content()
    return {
        "concepts": [{**x.public(), "verify_items": sum(1 for i in c.items.values() if i.concept == x.concept_id and i.verify_flags)}
                     for x in c.concepts],
        "items": [i.model_dump() for i in c.items.values()],
        "misconceptions": [m.model_dump() for m in c.misconceptions.values()],
        "cards": [card.model_dump() for card in c.cards.values()],
    }
