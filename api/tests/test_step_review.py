"""Step review: is the mistake a wrong idea or a calculation slip? Rules decide; Claude only explains or fills gaps."""
import pytest
from fastapi.testclient import TestClient

from api import tutor
from api.ai import llm
from api.content import CORRECT, load_content
from api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def mcq(client, learner, item_id, option, reason_id):
    res = client.post("/responses", json={"learner_id": learner, "item_id": item_id, "option": option,
                                          "reason_id": reason_id, "confidence": "sure"})
    assert res.status_code == 200, res.text
    return res.json()


def pick(client, response_id, step, working=None):
    body = {"step": step, **({"working": working} if working is not None else {})}
    res = client.post(f"/responses/{response_id}/step", json=body)
    assert res.status_code == 200, res.text
    return res.json()["step_check"]["review"]


def right_reason(item_id):
    return next(r for r, v in load_content().items[item_id].reasons.items() if v.maps_to == CORRECT)


def amplitude_mistake(client, learner):  # C1-P1 A + "from P all the way to Q": the S1 idea, traced to step 1
    return mcq(client, learner, "C1-P1", "A", "r2")


def dropped_half(client, learner):  # C5-P1 D with the right reason: a slip, traced to step 1 (HALF)
    return mcq(client, learner, "C5-P1", "D", right_reason("C5-P1"))


def claude_says(monkeypatch, **out):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    result = {"kind": "conceptual", "code": None, "habit": None, "explanation": "A short note.", "quote": None,
              "confidence": 0.9, **out}
    monkeypatch.setattr(llm, "review_step", lambda *a, **k: result)


def test_conceptual_from_the_rules_trace(client):
    fb = amplitude_mistake(client, "rv-concept")
    rv = pick(client, fb["response_id"], 3)
    assert (rv["kind"], rv["code"], rv["step"], rv["engine"]) == ("conceptual", "S1", 1, "rules")
    assert rv["card_id"] and rv["habit"] is None and rv["practice_item_id"] is None


def test_calculation_from_the_rules_trace_with_habit(client):
    fb = dropped_half(client, "rv-calc")
    rv = pick(client, fb["response_id"], 2)
    assert (rv["kind"], rv["code"], rv["habit"]["code"]) == ("calculation", None, "HALF")
    assert rv["practice_item_id"]


def test_diagnosed_idea_decides_when_no_step_names_it(client):
    res = client.post("/responses", json={"learner_id": "rv-diag", "item_id": "C6-Q3",
                                          "answer_text": "Light always bends toward the normal, so it comes out closer to the normal."})
    fb = res.json()
    assert fb["misconception_code"] == "R3"
    rv = pick(client, fb["response_id"], 2)  # step 2's usual mistake is a slip, but the answer was graded as R3
    assert (rv["kind"], rv["code"]) == ("conceptual", "R3")


def test_claude_decides_only_when_the_rules_know_nothing(client, monkeypatch):
    fb = dropped_half(client, "rv-claude")
    monkeypatch.setattr(tutor, "traced_step", lambda *a: None)
    claude_says(monkeypatch, kind="calculation", habit="ARITH", explanation="You multiplied too early.")
    rv = pick(client, fb["response_id"], 2, "I did 80 x 0.05 first")
    assert (rv["kind"], rv["habit"]["code"], rv["engine"]) == ("calculation", "ARITH", "rules+claude")
    assert rv["explanation"] == "You multiplied too early."


def test_confident_disagreement_asks_once_and_never_overrides(client, monkeypatch):
    fb = amplitude_mistake(client, "rv-disagree")
    claude_says(monkeypatch, kind="calculation", habit="ARITH", confidence=0.9)
    rv = pick(client, fb["response_id"], 1)
    assert rv["needs_detail"] and rv["question"] == "What did you get at step 1?"
    assert (rv["kind"], rv["code"]) == ("conceptual", "S1")
    rv = pick(client, fb["response_id"], 1, "I took 12 cm")
    assert not rv["needs_detail"] and (rv["kind"], rv["code"]) == ("conceptual", "S1")


def test_agreeing_claude_only_adds_the_explanation(client, monkeypatch):
    fb = amplitude_mistake(client, "rv-agree")
    claude_says(monkeypatch, kind="conceptual", code="S1", explanation="Amplitude is half the gap.")
    rv = pick(client, fb["response_id"], 1)
    assert (rv["kind"], rv["code"], rv["explanation"], rv["needs_detail"]) == ("conceptual", "S1", "Amplitude is half the gap.", False)


@pytest.mark.parametrize("bad", [
    {"code": "S99"},                                           # not one of the item's ideas
    {"quote": "I never wrote this"},                           # quote not in the student's words
    {"explanation": "The amplitude is 37 cm."},                # number not in the material
    {"kind": "calculation", "code": "S1", "habit": "NONE"},   # a slip can't carry an idea
])
def test_invalid_claude_output_is_rejected(monkeypatch, bad):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    data = {"kind": "conceptual", "code": "S1", "habit": "NONE", "explanation": "Amplitude is half the gap.",
            "quote": "", "confidence": 0.8, **bad}
    monkeypatch.setattr(llm, "_json_call", lambda *a, **k: data)
    item = load_content().items["C1-P1"]
    codes = {"S1": "x", "S3": "y"}
    assert llm.review_step(item, 1, "A: Amplitude 12 cm", "I took 12 cm", codes, {"HALF": "h"}) is None


def test_rejected_or_missing_claude_falls_back_to_rules(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    monkeypatch.setattr(llm, "_json_call", lambda *a, **k: None)
    fb = amplitude_mistake(client, "rv-off")
    rv = pick(client, fb["response_id"], 3)
    assert (rv["kind"], rv["code"], rv["engine"], rv["explanation"]) == ("conceptual", "S1", "rules", None)


def test_calculation_reviews_count_toward_habits(client, monkeypatch):
    monkeypatch.setattr(tutor, "traced_step", lambda *a: None)
    claude_says(monkeypatch, kind="calculation", habit="SIGN")
    for item_id in ("C5-P1", "C1-P1"):
        reason = right_reason(item_id)
        option = next(o for o, c in load_content().items[item_id].distractor_map.items() if c == "SLIP")
        pick(client, mcq(client, "rv-habit", item_id, option, reason)["response_id"], 1)
    assert "SIGN" in [h["code"] for h in client.get("/habits/rv-habit").json()["habits"]]


def test_a_review_never_changes_mastery(client, monkeypatch):
    fb = amplitude_mistake(client, "rv-mastery")
    before = client.get("/mastery/rv-mastery").json()
    claude_says(monkeypatch, kind="conceptual", code="S1")
    pick(client, fb["response_id"], 1, "I took 12 cm")
    assert client.get("/mastery/rv-mastery").json() == before


def test_just_show_me_reveals_the_traced_step_without_counting_a_pick(client):
    fb = amplitude_mistake(client, "rv-reveal")
    assert fb["step_check"]["traceable"] and fb["step_check"]["traced"] is None  # hidden until asked
    out = client.post(f"/responses/{fb['response_id']}/reveal").json()["step_check"]
    assert (out["revealed"], out["picked"], out["traced"]) == (True, None, 1)
    assert out["analysis"]["lines"][0].startswith("Your answer comes from step 1")
    assert (out["review"]["kind"], out["review"]["code"]) == ("conceptual", "S1")
    ok = mcq(client, "rv-reveal-right", "C1-P1", "B", right_reason("C1-P1"))
    assert client.post(f"/responses/{ok['response_id']}/reveal").status_code == 409
