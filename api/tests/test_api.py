import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def post(client, learner, item, option, reason_id=None, confidence="sure", text=None):
    body = {"learner_id": learner, "item_id": item, "option": option, "confidence": confidence}
    body.update({"reason_id": reason_id} if reason_id else {"reason_text": text})
    res = client.post("/responses", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_next_item_hides_answer_key(client):
    item = client.get("/items/next", params={"learner_id": "fresh"}).json()["item"]
    assert item["item_id"] == "C1-P1"
    assert not {"correct", "distractor_map"} & item.keys()
    assert all(isinstance(t, str) for t in item["reasons"].values())  # no maps_to


def test_slip_sibling_then_upgrade_confirms(client):
    # C1-P1: B -> O1, r1 correct, r2 -> O1. C1-P3 is a sibling with C -> O1.
    fb = post(client, "asha", "C1-P1", "B", "r2")
    assert (fb["category"], fb["misconception_code"], fb["misconception_status"]) == ("MISCONCEPTION", "O1", "SUSPECTED")
    fb = post(client, "asha", "C1-P1", "B", "r1")
    assert (fb["category"], fb["rule_fired"], fb["sibling_scheduled"]) == ("SLIP", "slip:1", True)
    nxt = client.get("/items/next", params={"learner_id": "asha"}).json()["item"]["item_id"]
    assert nxt in {"C1-P2", "C1-P3"}
    fb = post(client, "asha", "C1-P3", "C", "r1")  # wrong the same way (O1) on a sibling
    assert (fb["category"], fb["rule_fired"]) == ("MISCONCEPTION", "slip:5")
    assert fb["misconception_status"] == "CONFIRMED"  # O1 evidence on 2 distinct items

    why = client.get(f"/diagnosis/{fb['response_id']}/why").json()
    assert why["rule_fired"] == "slip:5" and why["distractor_map_entry"] == {"C": "O1"}
    assert "classifier_confidence" in why


def test_typed_text_never_changes_mastery(client):
    before = client.get("/mastery/ben").json()["concepts"][1]
    fb = post(client, "ben", "C2-P1", "A", text="I understand")
    assert fb["category"] == "AMBIGUOUS" and fb["needs_clarification"]
    rid = fb["response_id"]
    assert client.post("/clarify", json={"response_id": rid, "text": "I understand it now"}).json()["category"] == "AMBIGUOUS"
    assert client.post("/clarify", json={"response_id": rid, "text": "yes really"}).json()["category"] == "UNDIAGNOSED"
    after = client.get("/mastery/ben").json()["concepts"][1]
    assert after == before
    assert client.post("/clarify", json={"response_id": rid, "text": "again"}).status_code == 409


def test_clarify_with_reason_option_resolves(client):
    fb = post(client, "cara", "C3-P1", "A", text="because waves")
    fb = client.post("/clarify", json={"response_id": fb["response_id"], "reason_id": "r1"}).json()
    assert fb["category"] == "SCIENTIFIC" and fb["mastery"]["p_learned"] == pytest.approx(0.7875, abs=0.001)


def test_bkt_through_api_reaches_mastery(client):
    ps = [post(client, "dev", f"C1-P{n}", "A", "r1")["mastery"]["p_learned"] for n in (1, 2, 3)]
    assert ps[:2] == pytest.approx([0.787, 0.975], abs=0.001)
    c1 = client.get("/mastery/dev").json()["concepts"][0]
    assert (c1["attempts"], c1["distinct_items"], c1["mastered"]) == (3, 3, True)
    assert client.get("/items/next", params={"learner_id": "dev"}).json()["item"]["concept"] == "C2"


def test_assessment_items_rejected_from_practice(client):
    res = client.post("/responses", json={"learner_id": "eve", "item_id": "C1-A1", "option": "A",
                                          "reason_id": "r1", "confidence": "sure"})
    assert res.status_code == 409


def test_explain_and_concepts(client):
    assert client.get("/explain/O1-R").json()["code"] == "O1"
    assert client.get("/explain/nope").status_code == 404
    assert len(client.get("/concepts").json()) == 9
