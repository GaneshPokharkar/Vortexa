"""WaveLoop AI backend. Run: uvicorn api.main:app --reload"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, model_validator
from sqlmodel import Session

from api import engine as eng
from api.content import Item, Option, ReasonId, load_content
from api.engine.grading import AMBIGUOUS, SLIP_CATEGORIES, UNDIAGNOSED
from api.store import (
    Diagnosis, Response, apply_response, current_p, db, ensure_learner, init_db, mastery,
    misconception_statuses, next_item, prior_slip_code,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_content()  # fail fast on invalid data files
    init_db()
    yield


app = FastAPI(title="WaveLoop AI", lifespan=lifespan)


def get_session():
    with Session(db) as s:
        yield s


class ResponseIn(BaseModel):
    learner_id: str
    item_id: str
    option: Option
    reason_id: Optional[ReasonId] = None
    reason_text: Optional[str] = None
    confidence: Literal["sure", "unsure"]

    @model_validator(mode="after")
    def _needs_reason(self) -> "ResponseIn":
        if not self.reason_id and not (self.reason_text or "").strip():
            raise ValueError("give reason_id or reason_text")
        return self


class ClarifyIn(BaseModel):
    response_id: int
    reason_id: Optional[ReasonId] = None
    text: Optional[str] = None


def _item(item_id: str) -> Item:
    item = load_content().items.get(item_id)
    if item is None:
        raise HTTPException(404, f"unknown item {item_id}")
    return item


def _clarify_payload(d: Diagnosis, item: Item) -> dict:
    content = load_content()
    codes = [c for c in (d.option_code, d.reason_code) if c in content.misconceptions]
    return {
        "probes": [content.misconceptions[c].contrast_probe for c in dict.fromkeys(codes)],
        "reasons": item.public()["reasons"],
        "remaining": eng.MAX_CLARIFICATIONS - d.clarifications,
    }


def _feedback(session: Session, r: Response, d: Diagnosis) -> dict:
    content = load_content()
    mc = content.misconceptions.get(d.misconception_code or "")
    words = eng.content_word_count(r.reason_text or "")
    return {
        "response_id": r.id,
        "category": d.category,
        "rule_fired": d.rule_fired,
        "rule_text": eng.RULES[d.rule_fired],
        "misconception_code": d.misconception_code,
        "misconception_status": misconception_statuses(session, r.learner_id).get(d.misconception_code or ""),
        "remediation_card_id": mc.remediation_card_id if mc else f"{r.concept}-K",
        "followup_item_ids": mc.followup_item_ids if mc else [],
        "sibling_scheduled": d.category in SLIP_CATEGORIES,
        # No classifier yet (top1 = top2 = 0), so every AMBIGUOUS response asks for clarification.
        "needs_clarification": d.category == AMBIGUOUS
        and eng.needs_clarification(d.classifier_score or 0.0, 0.0, words, d.rule_fired == "slip:4"),
        "clarify": _clarify_payload(d, content.items[r.item_id]) if d.category == AMBIGUOUS else None,
        "mastery": {"concept": r.concept, "p_learned": round(current_p(session, r.learner_id, r.concept), 4)},
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/concepts")
def concepts():
    return load_content().concepts


@app.get("/items/next")
def items_next(learner_id: str, session: Session = Depends(get_session)):
    item_id = next_item(session, learner_id)
    return {"item": load_content().items[item_id].public() if item_id else None}


@app.post("/responses")
def post_response(body: ResponseIn, session: Session = Depends(get_session)):
    item = _item(body.item_id)
    if item.is_assessment:
        raise HTTPException(409, "assessment items are answered through the assessment flow")
    ensure_learner(session, body.learner_id)
    g = eng.grade(
        item, body.option, body.reason_id, body.confidence,
        p_learned=current_p(session, body.learner_id, item.concept),
        prior_slip_code=prior_slip_code(session, body.learner_id, item.item_id),
    )
    r = Response(
        learner_id=body.learner_id, item_id=item.item_id, concept=item.concept, option=body.option,
        reason_id=body.reason_id, reason_text=body.reason_text, confidence=body.confidence,
    )
    session.add(r)
    session.flush()
    d = Diagnosis(
        response_id=r.id, category=g.category, rule_fired=g.rule_fired, option_code=g.option_code,
        reason_code=g.reason_code, misconception_code=g.misconception_code,
    )
    session.add(d)
    session.commit()
    apply_response(session, r.id)
    return _feedback(session, r, d)


@app.post("/clarify")
def clarify(body: ClarifyIn, session: Session = Depends(get_session)):
    r, d = session.get(Response, body.response_id), session.get(Diagnosis, body.response_id)
    if r is None or d is None:
        raise HTTPException(404, "unknown response")
    if d.category != AMBIGUOUS:
        raise HTTPException(409, f"response is {d.category}, not AMBIGUOUS")
    d.clarifications += 1
    if body.text:
        r.reason_text = f"{r.reason_text or ''}\n{body.text}".strip()
    if body.reason_id:
        g = eng.grade(_item(r.item_id), r.option, body.reason_id, r.confidence, current_p(session, r.learner_id, r.concept))
        r.reason_id, d.reason_code = body.reason_id, g.reason_code
        d.category, d.rule_fired, d.misconception_code = g.category, g.rule_fired, g.misconception_code
    if d.category == AMBIGUOUS and d.clarifications >= eng.MAX_CLARIFICATIONS:
        d.category, d.rule_fired = UNDIAGNOSED, "clarify:limit"
    session.add_all([r, d])
    session.commit()
    apply_response(session, r.id)
    return _feedback(session, r, d)


@app.get("/mastery/{learner_id}")
def get_mastery(learner_id: str, session: Session = Depends(get_session)):
    return {"learner_id": learner_id, "concepts": mastery(session, learner_id)}


@app.get("/explain/{card_id}")
def explain(card_id: str):
    card = load_content().cards.get(card_id)
    if card is None:
        raise HTTPException(404, f"unknown card {card_id}")
    return card


@app.get("/diagnosis/{response_id}/why")
def why(response_id: int, session: Session = Depends(get_session)):
    r, d = session.get(Response, response_id), session.get(Diagnosis, response_id)
    if r is None or d is None:
        raise HTTPException(404, "unknown response")
    item = _item(r.item_id)
    return {
        "response_id": r.id,
        "item_id": r.item_id,
        "category": d.category,
        "rule_fired": d.rule_fired,
        "rule_text": eng.RULES[d.rule_fired],
        "distractor_map_entry": {r.option: item.distractor_map[r.option]},
        "reason": {"reason_id": r.reason_id, "maps_to": d.reason_code} if r.reason_id else None,
        "reason_text": r.reason_text,
        "classifier_confidence": d.classifier_score,
        "clarifications": d.clarifications,
        "misconception_status": misconception_statuses(session, r.learner_id).get(d.misconception_code or ""),
    }
