"""Socratic dialogue with a confused classmate ("Rohan") who holds one misconception.

The student tries to convince Rohan. Every student message goes through the 3-agent orchestrator, judged against a
short-answer item of the same concept. The rules (not the language model) decide Rohan's next move:
convinced -> concede; same wrong idea or another one -> push back (and flag it for the teacher); unclear -> ask why.
Claude only words Rohan's lines when configured; otherwise a script built from the curated content speaks for him.
Dialogue turns feed the teacher's misconception map. They never change mastery.
"""
from __future__ import annotations

import json
from typing import Optional

from sqlmodel import Session, select

from api import orchestrator
from api.ai import llm
from api.content import Item, load_content
from api.engine.grading import (
    AMBIGUOUS, CORRECT_CATEGORIES, FALSE_POSITIVE, GROUP, GROUP_LABEL, MISCONCEPTION, OFF_TOPIC, PARTIAL,
)
from api.store import Dialogue, DialogueTurn, _now, dump, misconception_statuses

PEER_NAME = "Rohan"
MAX_STUDENT_TURNS = 5


class DialogueError(Exception):
    pass


def _items_for(concept: str, code: Optional[str]) -> list[Item]:
    content = load_content()
    pool = [i for i in content.items.values() if i.concept == concept and i.kind == "short" and not i.is_assessment]
    return [i for i in pool if code is None or code in i.codes()]


def _pick_code(session: Session, learner_id: str, concept: str, code: Optional[str]) -> str:
    content = load_content()
    concept_codes = [m.code for m in content.misconceptions.values() if m.concept == concept and _items_for(concept, m.code)]
    if not concept_codes:
        raise DialogueError(f"No dialogue is available for {concept} yet.")
    if code:
        if code not in concept_codes:
            raise DialogueError(f"{code} is not a misconception of {concept} with a dialogue.")
        return code
    # The learner's own flagged idea first (confirmed before suspected), else the concept's first one.
    statuses = misconception_statuses(session, learner_id)
    mine = sorted((c for c in concept_codes if c in statuses), key=lambda c: statuses[c] != "CONFIRMED")
    return mine[0] if mine else concept_codes[0]


def _material(concept: str, code: str) -> str:
    content = load_content()
    card = content.cards[f"{concept}-K"]
    rc = content.cards.get(content.misconceptions[code].remediation_card_id)
    return " ".join(x for x in [card.statement, card.simple, card.worked_example, rc.why_wrong if rc else ""] if x)


def _script(move: str, dlg: Dialogue, item: Item, flagged: Optional[str], n_pushes: int) -> str:
    """Rohan's lines without a language model, built only from the curated content."""
    content = load_content()
    m = content.misconceptions[dlg.code]
    examples = m.exemplars or [m.description]
    if move == "open":
        return (f"We're stuck on this one: {item.stem} Honestly, I think {examples[0].rstrip('.')}. "
                f"Can you convince me I'm wrong?")
    if move == "concede":
        rc = content.cards.get(m.remediation_card_id)
        return f"Okay, that actually makes sense. You've convinced me. {rc.statement if rc else ''}".strip()
    if move == "teacher":
        return "We're still going round in circles. Let's ask our teacher about this one tomorrow."
    if move == "clarify":
        return item.follow_ups.get("CORRECT_NO_REASON") or "I don't get it yet. Why is that true?"
    # push: vary the challenge each time, from the same misconception's probes, follow-ups and phrasings
    if flagged and flagged != dlg.code:
        other = content.misconceptions[flagged]
        return f"Wait, so you think {other.description[0].lower()}{other.description[1:].rstrip('.')}? I'm not sure about that either. " \
               f"{other.contrast_probe}"
    options = [m.contrast_probe, item.follow_ups.get(dlg.code, ""), f"But {examples[min(1, len(examples) - 1)].rstrip('.')}, no?"]
    options = [o for o in options if o]
    return options[n_pushes % len(options)]


def _peer_says(session: Session, dlg: Dialogue, item: Item, move: str, flagged: Optional[str] = None) -> DialogueTurn:
    content = load_content()
    m = content.misconceptions[dlg.code]
    turns = session.exec(select(DialogueTurn).where(DialogueTurn.dialogue_id == dlg.id).order_by(DialogueTurn.id)).all()
    n_pushes = sum(1 for t in turns if t.role == "peer") - 1
    line, engine = None, "rules"
    if llm.live():
        line = llm.peer_line(move, m.description, m.exemplars, item.stem, _material(dlg.concept, dlg.code),
                             [(t.role, t.text) for t in turns])
        engine = "claude" if line else "rules"
    if not line:
        line = _script(move, dlg, item, flagged, max(n_pushes, 0))
    turn = DialogueTurn(dialogue_id=dlg.id, role="peer", text=line, engine=engine)
    session.add(turn)
    session.commit()
    return turn


def start(session: Session, learner_id: str, concept: str, code: Optional[str] = None) -> Dialogue:
    if concept not in {c.concept_id for c in load_content().concepts}:
        raise DialogueError(f"Unknown concept {concept}.")
    target = _pick_code(session, learner_id, concept, code)
    item = _items_for(concept, target)[0]
    dlg = Dialogue(learner_id=learner_id, concept=concept, code=target, item_id=item.item_id)
    session.add(dlg)
    session.commit()
    session.refresh(dlg)
    _peer_says(session, dlg, item, "open")
    return dlg


def reply(session: Session, dlg: Dialogue, text: str) -> Dialogue:
    if dlg.status != "open":
        raise DialogueError("This conversation has ended. Start a new one to keep going.")
    item = load_content().items[dlg.item_id]
    result, stages = orchestrator.run_short(item, text, "sure")
    flagged = result.code if result.category in (MISCONCEPTION, FALSE_POSITIVE) else None
    session.add(DialogueTurn(dialogue_id=dlg.id, role="student", text=text, engine=result.engine,
                             category=result.category, misconception_code=flagged,
                             evidence=dump(result.evidence), pipeline=dump(stages)))
    dlg.student_turns += 1
    dlg.updated_at = _now()

    if result.category in CORRECT_CATEGORIES:
        move, dlg.status = "concede", "resolved"
    elif result.category in (PARTIAL, AMBIGUOUS, OFF_TOPIC):
        move = "clarify"
    else:
        move = "push"
    if dlg.status == "open" and dlg.student_turns >= MAX_STUDENT_TURNS:
        move, dlg.status = "teacher", "unresolved"
    session.add(dlg)
    session.commit()
    _peer_says(session, dlg, item, move, flagged)
    session.refresh(dlg)
    return dlg


def view(session: Session, dlg: Dialogue) -> dict:
    content = load_content()
    turns = session.exec(select(DialogueTurn).where(DialogueTurn.dialogue_id == dlg.id).order_by(DialogueTurn.id)).all()
    out = []
    for t in turns:
        row = {"role": t.role, "text": t.text, "engine": t.engine}
        if t.role == "student":
            g = GROUP[t.category]
            row.update(group=g, group_label=GROUP_LABEL[g], flagged_code=t.misconception_code,
                       flagged_description=content.misconceptions[t.misconception_code].description if t.misconception_code else None,
                       evidence=json.loads(t.evidence), pipeline=json.loads(t.pipeline))
        out.append(row)
    return {
        "dialogue_id": dlg.id, "concept": dlg.concept, "peer_name": PEER_NAME,
        "peer_belief": content.misconceptions[dlg.code].description, "code": dlg.code,
        "question": content.items[dlg.item_id].stem, "status": dlg.status,
        "turns_left": max(0, MAX_STUDENT_TURNS - dlg.student_turns),
        "engine_note": "Rohan's lines are written by Claude; the rules judge your replies." if llm.live()
        else "Demo dialogue: Rohan's lines come from a script; the rules judge your replies.",
        "turns": out,
    }
