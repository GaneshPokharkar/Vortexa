"""Worked steps after a wrong answer: the learner picks where they went off track; rules trace where the answer did."""
import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def respond(client, body):
    res = client.post("/responses", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def pick(client, response_id, step):
    res = client.post(f"/responses/{response_id}/step", json={"step": step})
    assert res.status_code == 200, res.text
    return res.json()


def test_mcq_pick_is_compared_with_the_traced_step(client):
    fb = respond(client, {"learner_id": "steps-mcq", "item_id": "C1-P1", "option": "A", "reason_id": "r2", "confidence": "sure"})
    sc = fb["step_check"]
    assert len(sc["steps"]) == 3 and sc["picked"] is None and sc["traced"] is None and sc["analysis"] is None

    late = pick(client, fb["response_id"], 3)
    assert late["step_check"]["traced"] == 1  # option A comes from the amplitude mistake in step 1
    assert late["step_check"]["analysis"]["code"] == "S1"
    assert "earlier, at step 1" in late["step_check"]["analysis"]["lines"][0]
    assert late["mastery"] == fb["mastery"]  # self-report never moves mastery

    right = pick(client, fb["response_id"], 1)
    assert right["step_check"]["analysis"]["lines"][0].startswith("Yes, step 1")


def test_numeric_slip_traces_to_the_step_that_produces_that_number(client):
    fb = respond(client, {"learner_id": "steps-short", "item_id": "C7-Q1", "answer_text": "v = -60 cm"})
    assert fb["category"] == "COMPUTATIONAL_SLIP"
    out = pick(client, fb["response_id"], 1)["step_check"]
    assert out["traced"] == 2 and out["analysis"]["code"] is None
    assert "later, at step 2" in out["analysis"]["lines"][0]


def test_no_steps_for_a_correct_answer(client):
    fb = respond(client, {"learner_id": "steps-ok", "item_id": "C1-P1", "option": "B", "reason_id": "r1", "confidence": "sure"})
    assert fb["step_check"] is None
    assert client.post(f"/responses/{fb['response_id']}/step", json={"step": 1}).status_code == 409


def test_step_out_of_range(client):
    fb = respond(client, {"learner_id": "steps-range", "item_id": "C1-P1", "option": "D", "reason_id": "r1", "confidence": "sure"})
    assert client.post(f"/responses/{fb['response_id']}/step", json={"step": 4}).status_code == 422
