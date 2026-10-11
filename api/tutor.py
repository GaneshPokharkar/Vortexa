"""Tutor service: diagnose an answer, write the feedback, choose the next activity, adapt the explanation.

Rules decide every category (api/engine). Claude only adds evidence for free text the rules couldn't match
(api/ai/llm.py), and its proposal passes the same thresholds. Nothing here writes mastery except via
store.apply_response().
"""
from __future__ import annotations

import json
import re
from typing import Optional

from sqlmodel import Session, select

from api import engine as eng
from api.ai import llm
from api.content import CORRECT, Item, load_content
from api.engine.grading import (
    AMBIGUOUS, CORRECT_CATEGORIES, FALSE_POSITIVE, FRAGILE, GROUP, GROUP_LABEL, LACK_OF_KNOWLEDGE, MISCONCEPTION,
    OFF_TOPIC, PARTIAL, SCIENTIFIC, SLIP_CATEGORIES, UNDIAGNOSED,
)
from api import orchestrator
from api.store import (
    Diagnosis, Response, apply_response, current_p, dump, misconception_statuses, prior_slip_code, sibling_for, tries,
)

CLARIFIABLE = {AMBIGUOUS, PARTIAL, OFF_TOPIC}


# ---------------- diagnosis ----------------

def _mcq_evidence(item: Item, option: str, reason_id: Optional[str], reason_text: Optional[str], confidence: str,
                  g: eng.Grade) -> list[str]:
    content = load_content()
    ev = []
    code = item.distractor_map[option]
    if option == item.correct:
        ev.append(f"Option {option} is the correct answer.")
    elif code in content.misconceptions:
        ev.append(f"Option {option} is the answer you get if you think: {content.misconceptions[code].description}")
    elif code == "SLIP":
        ev.append(f"Option {option} comes from the right method with a careless step (sign, square, unit).")
    else:
        ev.append(f"Option {option} is not the correct answer.")
    if reason_id:
        rc = item.reasons[reason_id].maps_to
        ev.append("Your reason is the correct physics." if rc == CORRECT else
                  f"Your reason fits the idea: {content.misconceptions[rc].description}")
    elif reason_text:
        ev.append("You explained in your own words; the tutor needs a little more to match it to a reason.")
    ev.append("You said you were sure." if confidence == "sure" else "You said you weren't sure.")
    return ev


def diagnose(session: Session, item: Item, learner_id: str, *, option=None, reason_id=None, reason_text=None,
             answer_text=None, confidence: str = "sure") -> tuple[Response, Diagnosis]:
    p = current_p(session, learner_id, item.concept)
    if item.kind == "short":
        result, stages = orchestrator.run_short(item, answer_text or "", confidence)
        d_kwargs = dict(category=result.category, rule_fired=result.rule_fired, engine=result.engine,
                        misconception_code=result.code, classifier_score=result.confidence,
                        evidence=dump(result.evidence), pipeline=dump(stages))
        follow_key = result.follow_up_key
    else:
        g = eng.grade(item, option, reason_id, confidence, p_learned=p,
                      prior_slip_code=prior_slip_code(session, learner_id, item.item_id))
        d_kwargs = dict(category=g.category, rule_fired=g.rule_fired, option_code=g.option_code,
                        reason_code=g.reason_code, misconception_code=g.misconception_code,
                        evidence=dump(_mcq_evidence(item, option, reason_id, reason_text, confidence, g)),
                        pipeline=dump(orchestrator.mcq_stages(item, g)))
        follow_key = None
    r = Response(learner_id=learner_id, item_id=item.item_id, concept=item.concept, kind=item.kind, option=option,
                 reason_id=reason_id, reason_text=reason_text, answer_text=answer_text, confidence=confidence)
    session.add(r)
    session.flush()
    d = Diagnosis(response_id=r.id, **d_kwargs)
    d.visual = dump(orchestrator.overlay_for(item, d.category, d.misconception_code))
    d.follow_up = dump(follow_up(session, learner_id, item, d.category, d.misconception_code, follow_key))
    session.add(d)
    session.commit()
    apply_response(session, r.id)
    return r, d


def clarify(session: Session, r: Response, d: Diagnosis, *, reason_id=None, text=None) -> None:
    item = load_content().items[r.item_id]
    d.clarifications += 1
    if item.kind == "short":
        if text:
            r.answer_text = f"{r.answer_text or ''} {text}".strip()
            result, stages = orchestrator.run_short(item, r.answer_text, r.confidence)
            d.category, d.rule_fired, d.engine = result.category, result.rule_fired, result.engine
            d.misconception_code, d.classifier_score, d.evidence = result.code, result.confidence, dump(result.evidence)
            d.pipeline = dump(stages)
            key = result.follow_up_key
        else:
            key = "UNCLEAR"
    else:
        key = None
        if text:
            r.reason_text = f"{r.reason_text or ''}\n{text}".strip()
        if reason_id:
            g = eng.grade(item, r.option, reason_id, r.confidence, current_p(session, r.learner_id, r.concept))
            r.reason_id, d.reason_code = reason_id, g.reason_code
            d.category, d.rule_fired, d.misconception_code = g.category, g.rule_fired, g.misconception_code
            d.evidence = dump(_mcq_evidence(item, r.option, reason_id, r.reason_text, r.confidence, g))
            d.pipeline = dump(orchestrator.mcq_stages(item, g))
    if d.category in CLARIFIABLE and d.clarifications >= eng.MAX_CLARIFICATIONS:
        d.category, d.rule_fired = UNDIAGNOSED, "clarify:limit"
        d.evidence = dump(json.loads(d.evidence) + ["After two follow-up questions the tutor still can't tell, so this answer doesn't count."])
    d.visual = dump(orchestrator.overlay_for(item, d.category, d.misconception_code))
    d.follow_up = dump(follow_up(session, r.learner_id, item, d.category, d.misconception_code, key))
    session.add_all([r, d])
    session.commit()
    apply_response(session, r.id)


# ---------------- follow-up activity ----------------

def follow_up(session: Session, learner_id: str, item: Item, category: str, code: Optional[str],
              key: Optional[str]) -> dict:
    content = load_content()
    tried = tries(session, learner_id)
    concept_items = [i for i in content.items.values() if i.concept == item.concept and not i.is_assessment
                     and i.item_id != item.item_id]

    def least_tried(pool: list[Item]) -> Optional[str]:
        return min(pool, key=lambda i: tried.get(i.item_id, 0)).item_id if pool else None

    def fu(kind: str, prompt: str, item_id: Optional[str] = None, card_id: Optional[str] = None) -> dict:
        return {"kind": kind, "prompt": prompt, "item_id": item_id, "card_id": card_id}

    short_prompt = item.follow_ups.get(key or "", "") if item.kind == "short" else ""
    if category in (MISCONCEPTION, FALSE_POSITIVE) and code:
        m = content.misconceptions[code]
        targeted = [i for i in concept_items if code in i.codes()]
        prompt = short_prompt or m.contrast_probe or "Let's test that idea with a different question."
        return fu("question", prompt, least_tried(targeted) or least_tried(concept_items), m.remediation_card_id)
    if category in SLIP_CATEGORIES:
        return fu("sibling", "Your reasoning looked right. Try this similar question to check it was just a slip.",
                  sibling_for(session, learner_id, item.item_id) or least_tried(concept_items))
    if category == SCIENTIFIC:
        transfer = [i for i in concept_items if i.transfer]
        prompt = short_prompt or "Ready for a harder application question?"
        return fu("transfer", prompt, least_tried(transfer) or least_tried(concept_items))
    if category == FRAGILE:
        return fu("question", "You were right but unsure. One more like this will build confidence.", least_tried(concept_items))
    if category in (PARTIAL, AMBIGUOUS, OFF_TOPIC):
        prompt = short_prompt or "Can you say a bit more about why?"
        return fu("clarify", prompt)
    if category == LACK_OF_KNOWLEDGE:
        return fu("card", "Let's look at the idea another way, then try again.", least_tried(concept_items), f"{item.concept}-K")
    return fu("card", "This one is worth asking your teacher about, too. Here's the main idea again.",
              least_tried(concept_items), f"{item.concept}-K")


# ---------------- feedback payload ----------------

def _teaching_text(item: Item, d: Diagnosis) -> str:
    content = load_content()
    cat = d.category
    if cat in CORRECT_CATEGORIES:
        why = item.expected_reasoning if item.kind == "short" else next(
            r.text for r in item.reasons.values() if r.maps_to == CORRECT)
        return ("Exactly. " if cat == SCIENTIFIC else "That's right, and it's fine to be unsure. ") + why
    if cat in (MISCONCEPTION, FALSE_POSITIVE) and d.misconception_code:
        card = content.cards.get(content.misconceptions[d.misconception_code].remediation_card_id)
        lead = "Your answer is right, but the reason isn't. " if cat == FALSE_POSITIVE else ""
        return lead + (card.why_wrong if card else content.misconceptions[d.misconception_code].description)
    if cat in SLIP_CATEGORIES:
        return "Your method looks sound. Recheck the arithmetic, signs and units on the next question."
    if cat == PARTIAL:
        return "That looks right. Before we move on, tell the tutor why it's true."
    if cat == LACK_OF_KNOWLEDGE:
        return content.cards[f"{item.concept}-K"].simple or "Let's go over the idea once more."
    if cat == OFF_TOPIC:
        return f"Let's stay with the question: {item.stem}"
    if cat == UNDIAGNOSED:
        return "The tutor couldn't work out your reasoning, so this answer doesn't count. Read the idea again, or ask your teacher."
    return "The tutor needs one more detail before it can diagnose this."


def _correct_answer(item: Item, category: str) -> Optional[str]:
    if category not in CORRECT_CATEGORIES | {LACK_OF_KNOWLEDGE, UNDIAGNOSED}:
        return None  # guide first; don't hand over the answer
    if item.kind == "short":
        return item.answer_key
    return f"{item.correct}: {item.options[item.correct]}"


def _clarify_payload(item: Item, d: Diagnosis) -> Optional[dict]:
    if d.category not in CLARIFIABLE:
        return None
    content = load_content()
    if item.kind == "short":
        fu = json.loads(d.follow_up) or {}
        return {"probes": [fu.get("prompt") or item.follow_ups.get("UNCLEAR", "Can you explain a little more?")],
                "reasons": {}, "remaining": eng.MAX_CLARIFICATIONS - d.clarifications}
    codes = list(dict.fromkeys(c for c in (d.option_code, d.reason_code) if c in content.misconceptions))
    pair = next((p.probe for p in content.concept(item.concept).contrast_probes if set(p.separates) == set(codes)), None)
    return {
        "probes": [pair] if len(codes) == 2 and pair else [content.misconceptions[c].contrast_probe for c in codes],
        "reasons": item.public()["reasons"],
        "remaining": eng.MAX_CLARIFICATIONS - d.clarifications,
    }


def your_answer(r: Response) -> str:
    if r.kind == "short":
        return r.answer_text or ""
    item = load_content().items[r.item_id]
    out = f"{r.option}: {item.options[r.option]}"
    if r.reason_id:
        out += f" — because {item.reasons[r.reason_id].text[0].lower()}{item.reasons[r.reason_id].text[1:]}"
    elif r.reason_text:
        out += f" — “{r.reason_text}”"
    return out


def feedback(session: Session, r: Response, d: Diagnosis, mastery_row: dict) -> dict:
    content = load_content()
    item = content.items[r.item_id]
    mc = content.misconceptions.get(d.misconception_code or "")
    words = eng.content_word_count(r.answer_text or r.reason_text or "")
    group = GROUP[d.category]
    return {
        "response_id": r.id,
        "category": d.category,
        "group": group,
        "group_label": GROUP_LABEL[group],
        "rule_fired": d.rule_fired,
        "rule_text": eng.RULES[d.rule_fired],
        "engine": d.engine,
        "evidence": json.loads(d.evidence),
        "confidence": d.classifier_score,
        "your_answer": your_answer(r),
        "correct_answer": _correct_answer(item, d.category),
        "feedback_text": _teaching_text(item, d),
        "follow_up": json.loads(d.follow_up),
        "visual_correction": json.loads(d.visual),
        "step_by_step": None,  # TODO: implement step-by-step analysis for multi-step problems
        "pipeline": json.loads(d.pipeline),
        "misconception_code": d.misconception_code,
        "misconception_status": misconception_statuses(session, r.learner_id).get(d.misconception_code or ""),
        "remediation_card_id": mc.remediation_card_id if mc else f"{r.concept}-K",
        "followup_item_ids": mc.followup_item_ids if mc else [],
        "sibling_scheduled": d.category in SLIP_CATEGORIES,
        "needs_clarification": d.category in CLARIFIABLE and (
            item.kind == "short" or eng.needs_clarification(d.classifier_score or 0.0, 0.0, words, d.rule_fired == "slip:4")),
        "clarify": _clarify_payload(item, d),
        "mastery": {"concept": r.concept, "p_learned": mastery_row["p_learned"], "status": mastery_row["status"]},
    }


# ---------------- adaptive explanation ----------------

MODES = ["beginner", "steps", "worked", "analogy", "visual", "practice"]


def suggested_mode(session: Session, learner_id: Optional[str], concept: str) -> tuple[str, str]:
    """Pick the first explanation to show. After each struggle, rotate to a mode not yet tried."""
    if not learner_id:
        return "beginner", "New here: starting with the simple explanation."
    cats = session.exec(
        select(Diagnosis.category).join(Response)
        .where(Response.learner_id == learner_id, Response.concept == concept).order_by(Response.id.desc()).limit(4)
    ).all()
    if not cats:
        return "beginner", "No answers on this concept yet: starting with the simple explanation."
    struggles = [c for c in cats if c not in CORRECT_CATEGORIES]
    if cats[0] in CORRECT_CATEGORIES and len(struggles) == 0:
        return "practice", "Your recent answers here are right, so practice comes first."
    if cats[0] in SLIP_CATEGORIES:
        return "worked", "Your last answer looked like a slip: a worked example shows each step."
    rotation = ["visual", "analogy", "steps", "worked"]
    mode = rotation[(len(struggles) - 1) % len(rotation)]
    return mode, f"{len(struggles)} recent answer(s) here weren't right yet, so the tutor is trying a different explanation ({mode})."


# ---------------- grounded Q&A ----------------

_WORD = re.compile(r"[a-zα-ω²]+")


def _tokens(s: str) -> set[str]:
    stop = eng.diagnosis.STOP_WORDS
    return {w for w in _WORD.findall(s.lower()) if w not in stop and len(w) > 2}


def ask(concept: str, question: str) -> dict:
    content = load_content()
    c = content.concept(concept)
    card = content.cards[f"{concept}-K"]
    sources: dict[str, str] = {
        card.card_id: " ".join([card.statement, card.simple, card.formal, card.analogy, card.worked_example,
                                " ".join(card.steps), " ".join(e.expr for e in card.equations)]),
    }
    for n, d in enumerate(c.doubts, 1):
        sources[f"{concept}-D{n}"] = f"Q: {d.q}\nA: {d.a}"
    for m in content.misconceptions.values():
        rc = content.cards.get(m.remediation_card_id)
        if m.concept == concept and rc:
            sources[rc.card_id] = f"{rc.wrong_idea} {rc.why_wrong} {rc.statement}"

    answer = llm.answer(question, sources)
    if answer:
        return answer
    # Rules fallback: closest curated doubt, else the concept card, else refer to the teacher.
    q = _tokens(question)
    best, score = None, 0.0
    for sid, text in sources.items():
        t = _tokens(text)
        s = len(q & t) / (len(q) or 1)
        if s > score:
            best, score = sid, s
    if best is None or score < 0.34:
        return {"answer": "I'm not sure the course material covers that. Please ask your teacher, and meanwhile "
                          "try the explanation modes above.", "grounded_in": [], "engine": "rules", "refer_teacher": True}
    text = sources[best]
    if best.startswith(f"{concept}-D"):
        text = text.split("\nA: ", 1)[1]
    elif best == card.card_id:
        text = card.simple or card.statement
    else:
        rc = content.cards[best]
        text = f"{rc.why_wrong} {rc.statement}"
    return {"answer": text, "grounded_in": [best], "engine": "rules", "refer_teacher": False}
