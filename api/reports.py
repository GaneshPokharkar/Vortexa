"""Assessments, pre/post report, recommendations and common doubts."""
from __future__ import annotations

from typing import Optional

from sqlmodel import Session, select

from api.content import CORRECT, Item, load_content
from api.engine.grading import CORRECT_CATEGORIES, PARTIAL, grade
from api.engine.short import grade_short
from api.store import (
    Assessment, AssessmentSession, Diagnosis, Learner, Response, _now, attempts, mastery, misconception_statuses, next_item,
)

TRENDS_MIN_LEARNERS = 5  # never show a cross-learner trend backed by fewer learners than this


# ---------------- assessment ----------------

TOPICS = ("SHM", "OPTICS")


def form(topic: str = "ALL") -> list[Item]:
    """The fixed pre/post form for one topic: its multiple-choice assessment items, same order every time."""
    c = load_content()
    return [i for i in c.items.values() if i.is_assessment and i.kind == "mcq"
            and (topic == "ALL" or c.concept(i.concept).topic_id == topic)]


class AssessmentError(Exception):
    pass


def _find(session: Session, learner_id: str, kind: str, topic: str) -> Optional[AssessmentSession]:
    return session.exec(select(AssessmentSession).where(AssessmentSession.learner_id == learner_id,
                                                        AssessmentSession.kind == kind, AssessmentSession.topic == topic)).first()


def start(session: Session, learner_id: str, kind: str, topic: str = "ALL") -> AssessmentSession:
    existing = _find(session, learner_id, kind, topic)
    if existing:
        if existing.completed_at:
            raise AssessmentError(f"The {kind}-test is already complete for this learner.")
        return existing  # resume
    if kind == "post":
        pre = _find(session, learner_id, "pre", topic)
        if not pre or not pre.completed_at:
            raise AssessmentError("Finish the pre-test before the post-test.")
    s = AssessmentSession(learner_id=learner_id, kind=kind, topic=topic, total=len(form(topic)))
    session.add(s)
    session.commit()
    session.refresh(s)
    return s


def session_payload(session: Session, s: AssessmentSession) -> dict:
    answered = session.exec(select(Assessment.item_id).where(Assessment.session_id == s.id)).all()
    return {"session_id": s.id, "kind": s.kind, "topic": s.topic, "items": [i.public() for i in form(s.topic)], "answered": list(answered),
            "total": s.total, "completed": s.completed_at is not None}


def score_item(item: Item, option=None, reason_id=None, answer_text=None) -> tuple[bool, bool, str, Optional[str]]:
    """(answer_correct, reason_correct, category, code). Rules only, so pre and post are scored identically."""
    if item.kind == "short":
        r = grade_short(item, answer_text or "", "sure")
        answer_ok = r.category in CORRECT_CATEGORIES | {PARTIAL}
        return answer_ok, r.category in CORRECT_CATEGORIES, r.category, r.code
    g = grade(item, option, reason_id, "sure")
    reason_ok = bool(reason_id) and item.reasons[reason_id].maps_to == CORRECT
    return option == item.correct, reason_ok, g.category, g.misconception_code


def answer(session: Session, s: AssessmentSession, item_id: str, *, option=None, reason_id=None, answer_text=None) -> dict:
    if s.completed_at:
        raise AssessmentError("This assessment is already complete.")
    item = next((i for i in form(s.topic) if i.item_id == item_id), None)
    if item is None:
        raise AssessmentError(f"{item_id} is not on the assessment form.")
    if item.kind == "mcq" and not option:
        raise AssessmentError("Choose an option.")
    if item.kind == "short" and not (answer_text or "").strip():
        raise AssessmentError("Type an answer.")
    ok, reason_ok, cat, code = score_item(item, option, reason_id, answer_text)
    row = session.exec(select(Assessment).where(Assessment.session_id == s.id, Assessment.item_id == item_id)).first()
    row = row or Assessment(session_id=s.id, learner_id=s.learner_id, item_id=item_id, answer_correct=ok,
                            reason_correct=reason_ok, category=cat)
    row.option, row.reason_id, row.answer_text = option, reason_id, answer_text
    row.answer_correct, row.reason_correct, row.category, row.misconception_code = ok, reason_ok, cat, code
    session.add(row)
    session.commit()
    n = len(session.exec(select(Assessment.id).where(Assessment.session_id == s.id)).all())
    return {"answered": n, "total": s.total}


def complete(session: Session, s: AssessmentSession) -> dict:
    rows = session.exec(select(Assessment).where(Assessment.session_id == s.id)).all()
    missing = {i.item_id for i in form(s.topic)} - {r.item_id for r in rows}
    if missing:
        raise AssessmentError(f"{len(missing)} question(s) still unanswered.")
    if not s.completed_at:
        s.correct = sum(r.answer_correct for r in rows)
        s.total = len(rows)
        s.score_percentage = round(100 * s.correct / s.total, 1) if s.total else 0.0
        s.completed_at = _now()
        session.add(s)
        session.commit()
    return result(s)


def result(s: Optional[AssessmentSession]) -> Optional[dict]:
    if not s or not s.completed_at:
        return None
    return {"session_id": s.id, "kind": s.kind, "topic": s.topic, "correct": s.correct, "total": s.total,
            "score_percentage": s.score_percentage}


# ---------------- reports ----------------

def _pct(xs: list[float]) -> Optional[float]:
    return round(sum(xs) / len(xs), 1) if xs else None


def class_report(session: Session, include_demo: bool = False, topic: str = "ALL") -> dict:
    content = load_content()
    learners = session.exec(select(Learner)).all()
    ids = [l.id for l in learners if include_demo or not l.is_demo]
    labels = {lid: f"Learner {n}" for n, lid in enumerate(sorted(ids), 1)}  # anonymised
    sessions = session.exec(select(AssessmentSession).where(AssessmentSession.learner_id.in_(ids),
                                                             AssessmentSession.topic == topic)).all() if ids else []
    by = {(s.learner_id, s.kind): s for s in sessions}
    started_pre = [lid for lid in ids if (lid, "pre") in by]
    done_pre = [lid for lid in started_pre if by[(lid, "pre")].completed_at]
    both = [lid for lid in done_pre if (lid, "post") in by and by[(lid, "post")].completed_at]

    pre_scores = [by[(lid, "pre")].score_percentage for lid in both]
    post_scores = [by[(lid, "post")].score_percentage for lid in both]
    pre_mean, post_mean = _pct(pre_scores), _pct(post_scores)

    per_concept = []
    if both:
        rows = session.exec(select(Assessment, AssessmentSession).join(AssessmentSession)
                            .where(AssessmentSession.learner_id.in_(both), AssessmentSession.topic == topic)).all()
        for c in content.concepts:
            pre = [a.answer_correct for a, s in rows if s.kind == "pre" and content.items[a.item_id].concept == c.concept_id]
            post = [a.answer_correct for a, s in rows if s.kind == "post" and content.items[a.item_id].concept == c.concept_id]
            if pre and post:
                p0, p1 = 100 * sum(pre) / len(pre), 100 * sum(post) / len(post)
                per_concept.append({"concept": c.concept_id, "n": len(both), "pre": round(p0, 1), "post": round(p1, 1),
                                    "change_pp": round(p1 - p0, 1)})

    missing = []
    for lid in started_pre:
        if lid not in done_pre:
            missing.append({"learner": labels[lid], "reason": "Pre-test started but not finished; excluded."})
        elif lid not in both:
            missing.append({"learner": labels[lid], "reason": "No completed post-test yet; excluded from the change."})

    n = len(both)
    limitations = [
        f"n = {n} learner(s) completed both tests; only they are included in the pre/post change.",
        "Score change is in percentage points (post % minus pre %), not relative per cent change.",
        "The same questions are used before and after, so part of any gain may be memory or practice of those items.",
        "There is no control group, so the tutor cannot be said to have caused the change.",
        "Questions were written by the team and are still awaiting teacher review; they are not a validated test.",
    ]
    if n < 10:
        limitations.append("With fewer than 10 matched learners these results are preliminary and descriptive only.")
    if include_demo:
        limitations.append("Demo learners are included in this view; they are not real students.")
    return {
        "include_demo": include_demo, "topic": topic, "questions": len(form(topic)),
        "learners_started_pre": len(started_pre), "learners_completed_pre": len(done_pre),
        "learners_completed_both": n, "pre_mean": pre_mean, "post_mean": post_mean,
        "change_pp": round(post_mean - pre_mean, 1) if n else None,
        "per_concept": per_concept, "missing": missing, "limitations": limitations,
    }


def learner_report(session: Session, learner_id: str, topic: str = "ALL") -> dict:
    content = load_content()
    pre, post = result(_find(session, learner_id, "pre", topic)), result(_find(session, learner_id, "post", topic))
    counts: dict[str, int] = {}
    for code in session.exec(select(Diagnosis.misconception_code).join(Response).where(
            Response.learner_id == learner_id, Diagnosis.misconception_code != None)).all():  # noqa: E711
        counts[code] = counts.get(code, 0) + 1
    repeated = [{"code": k, "description": content.misconceptions[k].description, "count": v,
                 "concept": content.misconceptions[k].concept} for k, v in sorted(counts.items(), key=lambda x: -x[1]) if v >= 2]
    return {
        "pre": pre, "post": post,
        "change_pp": round(post["score_percentage"] - pre["score_percentage"], 1) if pre and post else None,
        "concepts": mastery(session, learner_id), "repeated_misconceptions": repeated,
        "recent": attempts(session, learner_id, limit=10), "revision_path": recommendations(session, learner_id)["items"],
    }


# ---------------- recommendations ----------------

def recommendations(session: Session, learner_id: str) -> dict:
    content = load_content()
    rows = {m["concept"]: m for m in mastery(session, learner_id)}
    statuses = misconception_statuses(session, learner_id)
    order = [c.concept_id for c in content.concepts]
    items = []

    for code, st in sorted(statuses.items(), key=lambda x: x[1] != "CONFIRMED"):
        m = content.misconceptions[code]
        seen = "on two or more different questions" if st == "CONFIRMED" else "once so far"
        items.append({"kind": "misconception", "concept": m.concept, "title": f"Revisit: {m.description}",
                      "reason": f"Answers linked to this idea showed up {seen}.", "card_id": m.remediation_card_id,
                      "item_id": next_item(session, learner_id, m.concept)})
    for cid in order:
        r = rows[cid]
        idx = order.index(cid)
        prev = order[idx - 1] if idx and content.concept(order[idx - 1]).topic_id == content.concept(cid).topic_id else None
        if r["attempts"] and r["status"] == "emerging" and prev and rows[prev]["status"] in ("not_assessed", "emerging"):
            items.append({"kind": "prerequisite", "concept": prev, "title": f"First: {content.concept(prev).name}",
                          "reason": f"{content.concept(cid).name} builds on it, and it isn't secure yet.",
                          "card_id": f"{prev}-K", "item_id": next_item(session, learner_id, prev)})
        if r["attempts"] and r["status"] in ("emerging", "developing") and not r["misconceptions"]:
            items.append({"kind": "revise", "concept": cid, "title": f"Practise: {content.concept(cid).name}",
                          "reason": r["status_reason"], "card_id": f"{cid}-K", "item_id": next_item(session, learner_id, cid)})
        h = r["history"]
        if len(h) >= 2 and h[-1] > h[-2] and r["status"] != "demonstrated":
            items.append({"kind": "improving", "concept": cid, "title": f"Improving: {content.concept(cid).name}",
                          "reason": f"P(L) rose from {h[-2]:.2f} to {h[-1]:.2f} on your last answer.",
                          "card_id": None, "item_id": None})
    nxt = next((cid for cid in order if rows[cid]["status"] != "demonstrated"), None)
    next_lesson = None
    if nxt:
        why = "It's the first concept on the path you haven't shown yet." if not rows[nxt]["attempts"] else rows[nxt]["status_reason"]
        next_lesson = {"concept": nxt, "reason": why}
        if not items:
            items.append({"kind": "next", "concept": nxt, "title": f"Start: {content.concept(nxt).name}",
                          "reason": "No answers yet, so the path starts here.", "card_id": f"{nxt}-K",
                          "item_id": next_item(session, learner_id, nxt)})
    return {"next_lesson": next_lesson, "items": items}


# ---------------- common doubts ----------------

def doubts(session: Session, q: Optional[str] = None, concept: Optional[str] = None) -> dict:
    content = load_content()
    out = []
    for c in content.concepts:
        if concept and c.concept_id != concept:
            continue
        for n, d in enumerate(c.doubts, 1):
            if q and not all(w in f"{d.q} {d.a}".lower() for w in q.lower().split()):
                continue
            out.append({"id": f"{c.concept_id}-D{n}", "concept": c.concept_id, "q": d.q, "a": d.a})
    # Measured trends across real (non-demo) learners only, and only with enough learners per idea.
    real = [l.id for l in session.exec(select(Learner).where(Learner.is_demo == False)).all()]  # noqa: E712
    per_code: dict[str, set[str]] = {}
    if real:
        for code, lid in session.exec(select(Diagnosis.misconception_code, Response.learner_id).join(Response).where(
                Response.learner_id.in_(real), Diagnosis.misconception_code != None)).all():  # noqa: E711
            per_code.setdefault(code, set()).add(lid)
    trends = [{"concept": content.misconceptions[k].concept, "code": k, "description": content.misconceptions[k].description,
               "learners": len(v)} for k, v in per_code.items() if len(v) >= TRENDS_MIN_LEARNERS]
    return {"curated": True,
            "note": "Curated examples written by the team for teaching, not measured trends.",
            "doubts": out, "trends": sorted(trends, key=lambda t: -t["learners"]) or None}
