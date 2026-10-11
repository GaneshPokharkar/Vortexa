"""WaveLoop AI backend. Run: uvicorn api.main:app --reload"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, model_validator
from sqlmodel import Session

from api import engine as eng
from api.content import Item, Option, ReasonId, load_content
from api.engine.grading import AMBIGUOUS, UNDIAGNOSED
from api.store import Response, apply_response, current_p, db, init_db, mastery, misconception_statuses, next_item


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


def _clarify_payload(r: Response, item: Item) -> dict:
    content = load_content()
    codes = [c for c in (r.option_code, r.reason_code) if c in content.misconceptions]
    return {
        "probes": [content.misconceptions[c].contrast_probe for c in dict.fromkeys(codes)],
        "reasons": item.public()["reasons"],
        "remaining": eng.MAX_CLARIFICATIONS - r.clarifications,
    }


def _feedback(session: Session, r: Response) -> dict:
    content = load_content()
    item = content.items[r.item_id]
    mc = content.misconceptions.get(r.misconception_code or "")
    concept_card = next((c.card_id for c in content.cards.values() if c.concept == r.concept), None)
    words = len((r.reason_text or "").split())
    return {
        "response_id": r.id,
        "category": r.category,
        "rule": r.rule,
        "rule_text": eng.RULES[r.rule],
        "misconception_code": r.misconception_code,
        "misconception_status": misconception_statuses(session, r.learner_id).get(r.misconception_code or ""),
        "remediation_card_id": mc.remediation_card_id if mc else concept_card,
        "followup_item_ids": mc.followup_item_ids if mc else [],
        "sibling_scheduled": r.category in eng.grading.SLIP_CATEGORIES,
        # No classifier yet (top1 = top2 = 0), so every AMBIGUOUS response asks for clarification.
        "needs_clarification": r.category == AMBIGUOUS
        and eng.needs_clarification(r.classifier_score or 0.0, 0.0, words, r.rule == "slip:4"),
        "clarify": _clarify_payload(r, item) if r.category == AMBIGUOUS else None,
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
    g = eng.grade(item, body.option, body.reason_id, body.confidence, current_p(session, body.learner_id, item.concept))
    r = Response(
        learner_id=body.learner_id, item_id=item.item_id, concept=item.concept, option=body.option,
        reason_id=body.reason_id, reason_text=body.reason_text, confidence=body.confidence,
        category=g.category, rule=g.rule, option_code=g.option_code, reason_code=g.reason_code,
        misconception_code=g.misconception_code,
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    apply_response(session, r.id)
    return _feedback(session, r)


@app.post("/clarify")
def clarify(body: ClarifyIn, session: Session = Depends(get_session)):
    r = session.get(Response, body.response_id)
    if r is None:
        raise HTTPException(404, "unknown response")
    if r.category != AMBIGUOUS:
        raise HTTPException(409, f"response is {r.category}, not AMBIGUOUS")
    item = _item(r.item_id)
    r.clarifications += 1
    if body.text:
        r.reason_text = f"{r.reason_text or ''}\n{body.text}".strip()
    if body.reason_id:
        g = eng.grade(item, r.option, body.reason_id, r.confidence, current_p(session, r.learner_id, r.concept))
        r.reason_id, r.reason_code = body.reason_id, g.reason_code
        r.category, r.rule, r.misconception_code = g.category, g.rule, g.misconception_code
    if r.category == AMBIGUOUS and r.clarifications >= eng.MAX_CLARIFICATIONS:
        r.category, r.rule = UNDIAGNOSED, "clarify:limit"
    session.add(r)
    session.commit()
    session.refresh(r)
    apply_response(session, r.id)
    return _feedback(session, r)


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
    r = session.get(Response, response_id)
    if r is None:
        raise HTTPException(404, "unknown response")
    item = _item(r.item_id)
    return {
        "response_id": r.id,
        "item_id": r.item_id,
        "category": r.category,
        "rule": r.rule,
        "rule_text": eng.RULES[r.rule],
        "distractor_map_entry": {r.option: item.distractor_map[r.option]},
        "reason": {"reason_id": r.reason_id, "maps_to": r.reason_code} if r.reason_id else None,
        "reason_text": r.reason_text,
        "classifier_confidence": r.classifier_score,
        "clarifications": r.clarifications,
        "misconception_status": misconception_statuses(session, r.learner_id).get(r.misconception_code or ""),
    }
