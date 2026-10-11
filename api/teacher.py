"""Teacher dashboard: the class misconception map.

For each concept: which faulty ideas are active and how many students hold them. For each student: the exact flagged
idea, the quoted words that triggered it (from practice answers or Socratic dialogues), and whether it has since been
resolved (a later correct answer on a question about that idea, or Rohan conceded in a dialogue).
Students are anonymous ("Learner 3"); demo learners are labelled. Only the reviewer token opens this view.

Step picks (after a wrong answer, the student taps the step where they think they went off track) are compared with
the step the answer traces to. Self-report only: they never change grading or mastery. Demo learners are left out of
the step picks unless include_demo is set.
"""
from __future__ import annotations

from collections import Counter

from sqlmodel import Session, select

from api.content import load_content
from api.engine.grading import CORRECT_CATEGORIES, FALSE_POSITIVE, MISCONCEPTION
from api.store import Diagnosis, Dialogue, DialogueTurn, Learner, Response, StepPick
from api.tutor import traced_step

PRELIMINARY_N = 10  # docs/ARCHITECTURE.md: label small samples


def class_map(session: Session, include_demo: bool = False) -> dict:
    content = load_content()
    learners = sorted(session.exec(select(Learner)).all(), key=lambda l: l.created_at)
    label, n = {}, 0
    for l in learners:
        if l.is_demo:
            label[l.id] = l.name
        else:
            n += 1
            label[l.id] = f"Learner {n}"

    # Every flag, with its quote and time.
    flags: dict[tuple[str, str], list[dict]] = {}
    rows = session.exec(select(Response, Diagnosis).join(Diagnosis)
                        .where(Diagnosis.category.in_([MISCONCEPTION, FALSE_POSITIVE]))).all()
    for r, d in rows:
        item = content.items.get(r.item_id)
        quote = r.answer_text if r.kind == "short" else (
            r.reason_text or (item.reasons[r.reason_id].text if item and r.reason_id else f"Option {r.option}"))
        flags.setdefault((r.learner_id, d.misconception_code), []).append(
            {"source": "practice", "item_id": r.item_id, "quote": quote, "at": r.created_at})
    turns = session.exec(select(DialogueTurn, Dialogue).join(Dialogue)
                         .where(DialogueTurn.misconception_code != None)).all()  # noqa: E711
    for t, dlg in turns:
        flags.setdefault((dlg.learner_id, t.misconception_code), []).append(
            {"source": "dialogue", "item_id": dlg.item_id, "quote": t.text, "at": t.created_at})

    # Evidence that a flagged idea was later fixed.
    fixes: dict[tuple[str, str], list] = {}
    correct = session.exec(select(Response, Diagnosis).join(Diagnosis)
                           .where(Diagnosis.category.in_(list(CORRECT_CATEGORIES)))).all()
    for r, _ in correct:
        item = content.items.get(r.item_id)
        for code in (item.codes() if item else set()):
            fixes.setdefault((r.learner_id, code), []).append(r.created_at)
    for dlg in session.exec(select(Dialogue).where(Dialogue.status == "resolved")).all():
        fixes.setdefault((dlg.learner_id, dlg.code), []).append(dlg.updated_at)

    students: dict[str, list[dict]] = {}
    per_code: dict[str, dict[str, int]] = {}
    for (lid, code), fl in flags.items():
        if code not in content.misconceptions:
            continue
        fl.sort(key=lambda f: f["at"])
        last = fl[-1]
        resolved = any(t > last["at"] for t in fixes.get((lid, code), []))
        distinct_items = len({f["item_id"] for f in fl})
        status = "resolved" if resolved else ("confirmed" if distinct_items >= 2 else "suspected")
        m = content.misconceptions[code]
        students.setdefault(lid, []).append({
            "code": code, "concept": m.concept, "description": m.description, "status": status,
            "times": len(fl), "quote": last["quote"], "source": last["source"], "when": last["at"].isoformat(),
        })
        c = per_code.setdefault(code, {"active": 0, "resolved": 0})
        c["resolved" if resolved else "active"] += 1

    concepts = []
    for c in content.concepts:
        ideas = [{"code": m.code, "description": m.description, **per_code.get(m.code, {"active": 0, "resolved": 0})}
                 for m in content.misconceptions.values() if m.concept == c.concept_id]
        concepts.append({"concept": c.concept_id, "name": c.name,
                         "misconceptions": sorted(ideas, key=lambda x: -x["active"])})
    by_learner = {l.id: l for l in learners}
    return {
        "steps": step_picks(session, content, label, by_learner, include_demo),
        "concepts": concepts,
        "students": [{"label": label.get(lid, "Learner"), "is_demo": bool(by_learner.get(lid) and by_learner[lid].is_demo),
                      "flags": sorted(f, key=lambda x: (x["status"] == "resolved", x["code"]))}
                     for lid, f in sorted(students.items(), key=lambda kv: label.get(kv[0], ""))],
        "note": "Flags are hypotheses from students' own words, not labels for the student. "
                "Confirmed = seen on two different questions; resolved = a later correct answer or a convinced peer.",
    }


def self_check(pairs: list[tuple[int, int | None]]) -> dict:
    """(picked, traced) pairs -> share of picks on the traced step, over picks that have a traced step."""
    traced = [(p, t) for p, t in pairs if t is not None]
    n, hits = len(traced), sum(p == t for p, t in traced)
    return {"n": n, "matches": hits, "accuracy": round(hits / n, 3) if n else None, "preliminary": n < PRELIMINARY_N}


def _top(steps: list[int]) -> dict | None:
    if not steps:
        return None
    step, count = Counter(steps).most_common(1)[0]
    return {"step": step, "count": count}


def step_picks(session: Session, content, label: dict, by_learner: dict, include_demo: bool) -> dict:
    rows = session.exec(select(Response, Diagnosis, StepPick)
                        .join(Diagnosis, Diagnosis.response_id == Response.id)
                        .join(StepPick, StepPick.response_id == Response.id)
                        .order_by(Response.created_at)).all()
    students: dict[str, list[dict]] = {}
    per_item: dict[str, tuple[list[int], list[int]]] = {}
    pairs = []
    for r, d, pick in rows:
        lr = by_learner.get(r.learner_id)
        item = content.items.get(r.item_id)
        if (lr and lr.is_demo and not include_demo) or not item or not item.steps:
            continue
        t = traced_step(item, r, d)
        pairs.append((pick.step, t))
        picked, traced = per_item.setdefault(r.item_id, ([], []))
        picked.append(pick.step)
        if t is not None:
            traced.append(t)
        students.setdefault(r.learner_id, []).append({
            "item_id": r.item_id, "picked": pick.step, "traced": t, "code": item.steps[t - 1].trap if t else None,
            "verdict": "no_trace" if t is None else ("match" if t == pick.step else "mismatch"),
        })
    return {
        "include_demo": include_demo,
        "self_check": self_check(pairs),
        "questions": [{"item_id": iid, "n": len(p), "n_traced": len(t), "picked": _top(p), "traced": _top(t)}
                      for iid, (p, t) in sorted(per_item.items())],
        "students": [{"label": label.get(lid, "Learner"), "is_demo": bool(by_learner.get(lid) and by_learner[lid].is_demo),
                      "picks": ps} for lid, ps in sorted(students.items(), key=lambda kv: label.get(kv[0], ""))],
        "note": "Step picks are self-report after a wrong answer; they never change grading or mastery. "
                "Self-check accuracy = picks on the traced step / picks whose answer traces to a step.",
    }
