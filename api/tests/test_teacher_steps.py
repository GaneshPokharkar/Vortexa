"""Teacher map: students' step picks vs the step their answer traces to. Self-report only; demo learners left out."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from api.engine.grading import MISCONCEPTION
from api.main import app
from api.store import Diagnosis, Response, StepPick, db, ensure_learner
from api.teacher import self_check


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def token(monkeypatch):
    monkeypatch.setenv("LEARNLOOP_REVIEWER_TOKEN", "t-steps")
    return {"X-Reviewer-Token": "t-steps"}


def wrong_and_pick(client, learner_id, step):
    # Option A + reason r2 on C1-P1 traces to step 1 (S1); see test_steps.py.
    fb = client.post("/responses", json={"learner_id": learner_id, "item_id": "C1-P1", "option": "A",
                                         "reason_id": "r2", "confidence": "sure"}).json()
    assert client.post(f"/responses/{fb['response_id']}/step", json={"step": step}).status_code == 200


def picks_by_item(steps):
    return [(p["item_id"], p["picked"], p["traced"], p["verdict"]) for s in steps["students"] for p in s["picks"]]


def test_match_mismatch_and_no_trace(client, token):
    before = client.get("/teacher/map", headers=token).json()["steps"]
    wrong_and_pick(client, "ts-match", 1)
    wrong_and_pick(client, "ts-mismatch", 3)
    with Session(db) as s:  # a wrong answer whose code no step's trap produces
        ensure_learner(s, "ts-notrace")
        r = Response(learner_id="ts-notrace", item_id="C1-P1", concept="C1", option="C")
        s.add(r)
        s.commit()
        s.add(Diagnosis(response_id=r.id, category=MISCONCEPTION, rule_fired="test", option_code="NO-SUCH-CODE"))
        s.add(StepPick(response_id=r.id, step=2))
        s.commit()

    steps = client.get("/teacher/map", headers=token).json()["steps"]
    new = picks_by_item(steps)
    assert ("C1-P1", 1, 1, "match") in new
    assert ("C1-P1", 3, 1, "mismatch") in new
    assert ("C1-P1", 2, None, "no_trace") in new
    match = next(p for s in steps["students"] for p in s["picks"] if p["item_id"] == "C1-P1" and p["verdict"] == "match")
    assert match["code"] == "S1"

    sc, old = steps["self_check"], before["self_check"]
    assert sc["n"] == old["n"] + 2  # the no-trace pick is not in the denominator
    assert sc["matches"] == old["matches"] + 1
    assert sc["preliminary"] == (sc["n"] < 10)

    q = next(q for q in steps["questions"] if q["item_id"] == "C1-P1")
    assert q["n"] > q["n_traced"]  # the no-trace pick counts as a pick, not as a traced step
    assert q["traced"]["step"] == 1 and q["picked"]["count"] >= 1


def test_self_check_small_sample_is_preliminary():
    small = self_check([(1, 1), (3, 1), (2, None)])
    assert small == {"n": 2, "matches": 1, "accuracy": 0.5, "preliminary": True}
    big = self_check([(1, 1)] * 9 + [(2, 1)])
    assert big["n"] == 10 and big["accuracy"] == 0.9 and big["preliminary"] is False
    assert self_check([])["accuracy"] is None


def test_demo_learners_left_out_unless_asked(client, token):
    wrong_and_pick(client, "asha", 2)
    off = client.get("/teacher/map", headers=token).json()["steps"]
    assert not any(s["is_demo"] for s in off["students"]) and off["include_demo"] is False
    on = client.get("/teacher/map?include_demo=true", headers=token).json()["steps"]
    assert any(s["is_demo"] for s in on["students"])
    assert on["self_check"]["n"] == off["self_check"]["n"] + 1


def test_needs_the_reviewer_token(client, token):
    assert client.get("/teacher/map", headers={"X-Reviewer-Token": "wrong"}).status_code == 401
