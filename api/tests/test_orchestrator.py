"""The 3-agent pipeline: trace, overlays with exact numbers, and Claude/rules disagreement handling."""
import pytest
from fastapi.testclient import TestClient

from api.ai import llm
from api.content import CORRECT, load_content
from api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def mcq(client, learner, item_id, code):
    """Answer with the option and reason both linked to `code`."""
    it = load_content().items[item_id]
    option = next(o for o, c in it.distractor_map.items() if c == code)
    reason = next(r for r, v in it.reasons.items() if v.maps_to == code)
    res = client.post("/responses", json={"learner_id": learner, "item_id": item_id, "option": option,
                                          "reason_id": reason, "confidence": "sure"})
    assert res.status_code == 200, res.text
    return res.json()


def short(client, learner, item_id, text):
    res = client.post("/responses", json={"learner_id": learner, "item_id": item_id, "answer_text": text})
    assert res.status_code == 200, res.text
    return res.json()


def test_every_answer_carries_a_three_stage_trace(client):
    fb = short(client, "o1", "C2-Q1", "It is constant everywhere.")
    assert [s["stage"] for s in fb["pipeline"]] == ["evaluate", "diagnose", "visualize"]
    assert [s["agent"] for s in fb["pipeline"]] == ["Evaluator", "Diagnoser", "Visual corrector"]
    why = client.get(f"/diagnosis/{fb['response_id']}/why").json()
    assert why["pipeline"] == fb["pipeline"]


def test_r7_angle_from_surface_overlay_uses_the_question_numbers(client):
    fb = short(client, "o2", "C6-Q3", "It is totally internally reflected because 4/3 sin 50 is more than 1")
    assert (fb["group"], fb["misconception_code"]) == ("B", "R7")
    v = fb["visual_correction"]
    assert (v["visual"], v["overlay"]) == ("refraction", "angle-from-surface")
    assert v["params"]["incidence"] == 40 and v["params"]["student_incidence"] == 50
    assert v["params"]["refracted"] == pytest.approx(59.0, abs=0.1) and v["params"]["student_refracted"] is None
    fb = mcq(client, "o2b", "C6-P4", "R7")
    assert fb["visual_correction"]["params"]["student_refracted"] == pytest.approx(35.3, abs=0.1)


def test_s4_r3_r5_overlays(client):
    s4 = short(client, "o3", "C2-Q1", "At the extreme position, because that is the farthest point.")["visual_correction"]
    assert s4["overlay"] == "speed-max-at-extremes" and s4["params"]["max_speed"] == pytest.approx(1.0)
    r3 = mcq(client, "o4", "C6-P2", "R3")["visual_correction"]
    assert r3["overlay"] == "bends-toward-normal" and r3["params"]["refracted"] > 25 > r3["params"]["student_refracted"]
    r5 = mcq(client, "o5", "C7-P1", "R5")["visual_correction"]
    assert r5["overlay"] == "half-lens-half-image" and r5["params"]["v"] == 60


def test_no_overlay_when_the_answer_is_right(client):
    it = load_content().items["C6-P4"]
    fb = client.post("/responses", json={
        "learner_id": "o6", "item_id": "C6-P4", "option": it.correct, "confidence": "sure",
        "reason_id": next(r for r, v in it.reasons.items() if v.maps_to == CORRECT)}).json()
    assert fb["group"] == "A" and fb["visual_correction"] is None


def test_claude_disagreeing_with_rules_triggers_a_question_not_an_override(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    monkeypatch.setattr(llm, "evaluate", lambda item, text: {
        "verdict": "incorrect", "reasoning_present": True, "confidence": 0.9, "quote": "mean position"})
    before = client.get("/mastery/o7").json()
    fb = short(client, "o7", "C2-Q1", "At the mean position, because the kinetic energy is greatest there.")
    assert (fb["category"], fb["rule_fired"], fb["group"]) == ("AMBIGUOUS", "orchestrator:disagree", "E")
    assert fb["pipeline"][0]["engine"] == "rules+claude" and "disagree" in fb["pipeline"][0]["outcome"]
    assert client.get("/mastery/o7").json() == before


def test_claude_agreeing_keeps_the_rules_result(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    monkeypatch.setattr(llm, "evaluate", lambda item, text: {
        "verdict": "correct", "reasoning_present": True, "confidence": 0.95, "quote": "mean position"})
    fb = short(client, "o8", "C2-Q1", "At the mean position, because the kinetic energy is greatest there.")
    assert fb["category"] == "SCIENTIFIC" and "agree" in fb["pipeline"][0]["outcome"]


def test_claude_failure_falls_back_to_rules_and_says_so(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    monkeypatch.setattr(llm, "_json_call", lambda *a, **k: None)
    fb = short(client, "o9", "C2-Q1", "It is constant everywhere.")
    assert fb["misconception_code"] == "S5" and fb["pipeline"][0]["engine"] == "rules"
    assert "unavailable" in fb["pipeline"][0]["outcome"]
