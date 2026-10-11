"""Mistake habits: the same careless slip on two different questions is flagged; it never touches mastery."""
import pytest
from fastapi.testclient import TestClient

from api.content import CORRECT, load_content
from api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def right_reason(item_id):
    return next(r for r, v in load_content().items[item_id].reasons.items() if v.maps_to == CORRECT)


def dropped_half_mcq(client, learner):
    # C5-P1 option D is the "dropped the ½" slip; with the right reason it is graded as a slip.
    res = client.post("/responses", json={"learner_id": learner, "item_id": "C5-P1", "option": "D",
                                          "reason_id": right_reason("C5-P1"), "confidence": "sure"})
    assert res.status_code == 200, res.text
    return res.json()


def dropped_half_short(client, learner):
    # C5-Q2: 2 J is the value you get by dropping the ½ in ½kA².
    res = client.post("/responses", json={"learner_id": learner, "item_id": "C5-Q2", "answer_text": "E = 2 J"})
    assert res.status_code == 200, res.text
    return res.json()


def test_same_slip_on_two_questions_becomes_a_habit(client):
    first = dropped_half_mcq(client, "habit-two")
    assert first["category"] in ("SLIP", "COMPUTATIONAL_SLIP") and first["habit"] is None
    second = dropped_half_short(client, "habit-two")
    assert second["category"] == "COMPUTATIONAL_SLIP"
    assert second["habit"]["code"] == "HALF" and second["habit"]["count"] == 2
    habits = client.get("/habits/habit-two").json()["habits"]
    assert [h["code"] for h in habits] == ["HALF"]


def test_repeating_one_question_is_not_a_habit(client):
    dropped_half_mcq(client, "habit-one")
    dropped_half_mcq(client, "habit-one")
    assert client.get("/habits/habit-one").json()["habits"] == []


def test_habits_never_change_mastery(client):
    dropped_half_mcq(client, "habit-mastery")
    dropped_half_short(client, "habit-mastery")
    before = client.get("/mastery/habit-mastery").json()
    client.get("/habits/habit-mastery")
    assert client.get("/mastery/habit-mastery").json() == before
