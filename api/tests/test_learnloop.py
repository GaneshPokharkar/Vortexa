"""Acceptance scenarios A–K from the LearnLoop AI build brief, end to end through the API."""
import pytest
from fastapi.testclient import TestClient

from api.ai import llm, voice
from api.content import CORRECT, load_content
from api.engine.short import LlmHint, grade_short
from api.main import app
from api.reports import form


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def say(client, learner, item, text, confidence=None):
    body = {"learner_id": learner, "item_id": item, "answer_text": text}
    if confidence:
        body["confidence"] = confidence
    res = client.post("/responses", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def mcq_key(item_id):
    i = load_content().items[item_id]
    return i.correct, next(r for r, v in i.reasons.items() if v.maps_to == CORRECT)


# A — correct understanding: acknowledged, then a harder (transfer) question.
def test_a_correct_understanding_advances(client):
    fb = say(client, "a", "C2-Q1", "At the mean position, because the restoring force is zero there and all the energy is kinetic.")
    assert (fb["category"], fb["group"]) == ("SCIENTIFIC", "A")
    assert fb["follow_up"]["kind"] == "transfer" and fb["correct_answer"]


# B + C — the brief's Student A and Student B: same question, different diagnosis, evidence and follow-up.
def test_b_c_different_wrong_answers_get_different_diagnoses(client):
    a = say(client, "stu-a", "C2-Q1", "At the extreme position, because that is the farthest point.")
    b = say(client, "stu-b", "C2-Q1", "It is constant everywhere.")
    assert (a["group"], a["misconception_code"]) == ("B", "S4")
    assert (b["group"], b["misconception_code"]) == ("B", "S5")
    assert a["evidence"] != b["evidence"]
    assert a["follow_up"]["prompt"] != b["follow_up"]["prompt"]
    assert "kinetic energy" in a["follow_up"]["prompt"].lower()
    assert a["remediation_card_id"] == "S4-R" and b["remediation_card_id"] == "S5-R"
    assert a["correct_answer"] is None  # guide first, don't hand over the answer


# D — a calculation slip is not a misconception.
def test_d_numeric_slip_is_not_a_misconception(client):
    item = load_content().items["C1-Q2"]
    slip = item.numeric.slips[0]
    fb = say(client, "d", "C1-Q2", f"{slip.value} m")
    assert (fb["category"], fb["group"], fb["misconception_code"]) == ("COMPUTATIONAL_SLIP", "C", None)
    mcq = load_content().items["C2-P2"]
    slip_opt = next(o for o, c in mcq.distractor_map.items() if c == "SLIP")
    fb = client.post("/responses", json={"learner_id": "d2", "item_id": "C2-P2", "option": slip_opt,
                                         "reason_id": mcq_key("C2-P2")[1], "confidence": "sure"}).json()
    assert fb["group"] == "C" and fb["sibling_scheduled"]


# E — ambiguous / incomplete: the brief's Student C gets a clarifying question, not an invented diagnosis.
def test_e_reason_unknown_triggers_clarification(client):
    fb = say(client, "c", "C2-Q1", "At the centre, I think.")
    assert (fb["category"], fb["group"], fb["misconception_code"]) == ("PARTIAL", "D", None)
    assert fb["needs_clarification"] and "why" in fb["follow_up"]["prompt"].lower()
    assert client.get("/mastery/c").json()["concepts"][1]["attempts"] == 0  # nothing counted yet
    fb = client.post("/clarify", json={"response_id": fb["response_id"],
                                       "text": "because the kinetic energy is greatest when it passes the mean position"}).json()
    assert fb["category"] == "SCIENTIFIC"
    assert client.get("/mastery/c").json()["concepts"][1]["attempts"] == 1


# F — changed understanding: the error and the later transfer success are both kept; status follows the rules.
def test_f_changed_understanding_is_recorded(client):
    say(client, "f", "C2-Q1", "At the extreme position, because that is the farthest point.")
    for item_id in ("C2-P1", "C2-P2", "C2-P3"):
        o, r = mcq_key(item_id)
        client.post("/responses", json={"learner_id": "f", "item_id": item_id, "option": o, "reason_id": r, "confidence": "sure"})
    h = client.get("/mastery/f/C2/history").json()
    assert len(h["attempts"]) == 4 and h["attempts"][0]["misconception_code"] == "S4"
    assert h["transfer_correct"] and h["status"] == "demonstrated"
    assert any("never changes" in r for r in h["reasons"])


def test_typing_i_understand_never_changes_mastery(client):
    before = client.get("/mastery/iu").json()
    fb = say(client, "iu", "C2-Q1", "I understand SHM")
    assert fb["group"] in ("E", "F")
    rid = fb["response_id"]
    client.post("/clarify", json={"response_id": rid, "text": "I understand"})
    client.post("/clarify", json={"response_id": rid, "text": "yes I get it"})
    assert client.get("/mastery/iu").json() == before


# G — assessment repeatability: same items, same keys, correct arithmetic.
def test_g_pre_post_use_same_items_and_score_correctly(client):
    learner = client.post("/learners", json={}).json()["learner_id"]
    assert client.post("/assessments", json={"learner_id": learner, "kind": "post"}).status_code == 409
    pre = client.post("/assessments", json={"learner_id": learner, "kind": "pre"}).json()
    assert all("correct" not in i and "answer_key" not in i for i in pre["items"])
    assert client.post(f"/assessments/{pre['session_id']}/complete").status_code == 409  # unanswered
    items = load_content().items
    for n, pub in enumerate(pre["items"]):
        it = items[pub["item_id"]]
        body = {"item_id": it.item_id}
        if it.kind == "mcq":
            right = n % 2 == 0  # answer half correctly
            body["option"] = it.correct if right else next(o for o in "ABCD" if o != it.correct)
        else:
            body["answer_text"] = it.answer_key if n % 2 == 0 else "no idea"
        assert client.post(f"/assessments/{pre['session_id']}/answers", json=body).status_code == 200
    res = client.post(f"/assessments/{pre['session_id']}/complete").json()
    assert res["total"] == len(form()) == 14
    assert res["score_percentage"] == round(100 * res["correct"] / res["total"], 1)
    post = client.post("/assessments", json={"learner_id": learner, "kind": "post"}).json()
    assert [i["item_id"] for i in post["items"]] == [i["item_id"] for i in pre["items"]]


# H — report counts only matched learners and explains the missing ones.
def test_h_report_matched_sample_and_missing_data(client):
    def full(learner, kind, correct):
        s = client.post("/assessments", json={"learner_id": learner, "kind": kind}).json()
        for it in (load_content().items[p["item_id"]] for p in s["items"]):
            body = {"item_id": it.item_id}
            if it.kind == "mcq":
                body["option"] = it.correct if correct else next(o for o in "ABCD" if o != it.correct)
            else:
                body["answer_text"] = it.answer_key if correct else "no idea"
            client.post(f"/assessments/{s['session_id']}/answers", json=body)
        return client.post(f"/assessments/{s['session_id']}/complete").json()

    both = client.post("/learners", json={}).json()["learner_id"]
    full(both, "pre", False)
    full(both, "post", True)
    pre_only = client.post("/learners", json={}).json()["learner_id"]
    full(pre_only, "pre", True)
    started = client.post("/learners", json={}).json()["learner_id"]
    client.post("/assessments", json={"learner_id": started, "kind": "pre"})

    r = client.get("/report").json()
    assert r["learners_completed_both"] >= 1
    assert r["learners_started_pre"] >= r["learners_completed_pre"] >= r["learners_completed_both"]
    assert r["change_pp"] == round(r["post_mean"] - r["pre_mean"], 1)
    reasons = " ".join(m["reason"] for m in r["missing"])
    assert "not finished" in reasons and "No completed post-test" in reasons
    assert any("percentage points" in x for x in r["limitations"])
    assert any("memory" in x for x in r["limitations"]) and any("control group" in x for x in r["limitations"])
    mine = client.get(f"/report/learner/{both}").json()
    assert mine["change_pp"] == 100.0 - mine["pre"]["score_percentage"]


# I — persistence: records survive a fresh database connection.
def test_i_records_persist_across_connections(client):
    from api.store import db
    say(client, "persist", "C2-Q1", "It is constant everywhere.")
    db.dispose()  # drop every pooled connection, like a server restart
    h = client.get("/mastery/persist/C2/history").json()
    assert h["attempts"] and h["attempts"][0]["misconception_code"] == "S5"


# J — provider failure: no key / failed calls never crash, and the UI is told the truth.
def test_j_missing_credentials_and_provider_failure(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    m = client.get("/modes").json()
    assert not m["llm"]["live"] and "Demo diagnosis engine" in m["llm"]["note"]
    assert not m["voice"]["live"]
    v = client.get("/voice/session", params={"learner_id": "x"}).json()
    assert v == {"available": False, "signed_url": None, "reason": voice.status()["note"]}
    # Key "present" but every call fails: diagnosis still answers from the rules.
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    monkeypatch.setattr(llm, "_json_call", lambda *a, **k: None)
    fb = say(client, "j", "C2-Q1", "The speed is like a bollywood dance move")
    assert fb["engine"] == "rules" and fb["group"] in ("E", "F")
    ans = client.post("/tutor/ask", json={"learner_id": "j", "concept": "C2", "question": "why is speed maximum at the mean position?"}).json()
    assert ans["engine"] == "rules"


# K — grounding: model output that invents numbers, codes or quotes is rejected.
def test_k_llm_output_is_grounded_or_rejected(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    item = load_content().items["C2-Q1"]
    monkeypatch.setattr(llm, "_json_call", lambda *a, **k: {
        "label": "S99", "confidence": 0.9, "runner_up_confidence": 0.1, "quote": "farthest", "reasoning_present": False})
    assert llm.classify(item, "the farthest place", {}) is None  # unknown code
    monkeypatch.setattr(llm, "_json_call", lambda *a, **k: {
        "label": "S4", "confidence": 0.9, "runner_up_confidence": 0.1, "quote": "words the student never said",
        "reasoning_present": False})
    assert llm.classify(item, "the farthest place", {}) is None  # quote not in answer
    monkeypatch.setattr(llm, "_json_call", lambda *a, **k: {
        "answer": "T = 2π√(m/k) gives 42 seconds, see textbook page 117.", "used_sources": ["C3-K"], "refer_teacher": False})
    assert llm.answer("what is the period?", {"C3-K": "T = 2π/ω and f = 1/T"}) is None  # invented numbers
    # A low-confidence hint never becomes a diagnosis.
    text = "it zooms when the spring is stretched the most"  # no rule phrase matches this
    assert grade_short(item, text).rule_fired == "short:unmatched"
    weak = LlmHint("S4", 0.55, 0.40, "stretched the most", False)
    assert grade_short(item, text, llm=weak).category == "AMBIGUOUS"
    strong = LlmHint("S4", 0.9, 0.05, "stretched the most", False)
    r = grade_short(item, text, llm=strong)
    assert (r.category, r.code, r.engine) == ("MISCONCEPTION", "S4", "llm")


def test_lesson_adapts_after_struggle(client):
    first = client.get("/concepts/C5/lesson", params={"learner_id": "adapt"}).json()
    assert first["suggested_mode"] == "beginner" and first["card"]["equations"]
    say(client, "adapt", "C5-Q1", "It keeps changing, energy is lost as it moves")
    second = client.get("/concepts/C5/lesson", params={"learner_id": "adapt"}).json()
    assert second["suggested_mode"] != "beginner" and second["mode_reason"]


def test_recommendations_explain_themselves(client):
    say(client, "rec", "C2-Q1", "At the extreme position, because that is the farthest point.")
    say(client, "rec", "C2-Q2", "Yes it is zero there since it stops")
    recs = client.get("/recommendations/rec").json()
    assert recs["items"] and all(r["reason"] for r in recs["items"])
    assert recs["items"][0]["kind"] == "misconception"


def test_doubts_are_labelled_curated_and_trends_hidden_without_data(client):
    d = client.get("/doubts", params={"q": "speed"}).json()
    assert d["curated"] is True and "not measured" in d["note"] and d["doubts"]
    assert d["trends"] is None


def test_demo_reset_only_for_demo_learners(client):
    say(client, "asha", "C2-Q1", "It is constant everywhere.")
    assert client.post("/demo/reset", json={"learner_id": "asha"}).json()["cleared"] >= 1
    assert client.post("/demo/reset", json={"learner_id": "anon-1234"}).status_code == 403


def test_review_requires_token(client, monkeypatch):
    monkeypatch.delenv("LEARNLOOP_REVIEWER_TOKEN", raising=False)
    assert client.get("/review").status_code == 503
    monkeypatch.setenv("LEARNLOOP_REVIEWER_TOKEN", "t0ken")
    assert client.get("/review", headers={"X-Reviewer-Token": "nope"}).status_code == 401
    body = client.get("/review", headers={"X-Reviewer-Token": "t0ken"}).json()
    assert body["items"] and "answer_key" in body["items"][-1]


def test_learner_report_lists_repeated_misconceptions(client):
    # Regression: the report crashed for any learner with misconceptions on record.
    for item, text in (("C2-Q1", "At the extreme position, because that is the farthest point."),
                       ("C2-Q1", "It is fastest at the extreme, the farthest point")):
        say(client, "rep", item, text)
    r = client.get("/report/learner/rep")
    assert r.status_code == 200
    assert any(m["code"] == "S4" and m["count"] >= 2 for m in r.json()["repeated_misconceptions"])
