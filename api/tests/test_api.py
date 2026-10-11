import pytest
from fastapi.testclient import TestClient

from api.content import CORRECT, load_content
from api.main import app


def key(item_id):
    """(correct option, correct reason id) for an item."""
    i = load_content().items[item_id]
    return i.correct, next(rid for rid, r in i.reasons.items() if r.maps_to == CORRECT)


def slip_pair():
    """(concept, code, P1 option, sibling id, sibling option) where P1 and a sibling share a wrong code."""
    items = load_content().items
    for p1 in (i for i in items.values() if i.item_id.endswith("-P1")):
        for sib_id in (p1.item_id[:-1] + "2", p1.item_id[:-1] + "3"):
            sib = items[sib_id]
            for o, code in p1.distractor_map.items():
                if o == p1.correct or code in (CORRECT, "SLIP", "UNMAPPED"):
                    continue
                match = [so for so, sc in sib.distractor_map.items() if sc == code and so != sib.correct]
                if match:
                    return p1.concept, code, o, sib_id, match[0]
    raise AssertionError("no P1/sibling pair shares a wrong code")


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


def test_slip_schedules_sibling_then_same_wrong_way_upgrades(client):
    concept, code, p1_opt, sib_id, sib_opt = slip_pair()
    p1 = f"{concept}-P1"
    fb = post(client, "asha", p1, p1_opt, key(p1)[1])  # wrong answer, correct reason
    assert (fb["category"], fb["rule_fired"], fb["sibling_scheduled"]) == ("SLIP", "slip:1", True)
    nxt = client.get("/items/next", params={"learner_id": "asha"}).json()["item"]["item_id"]
    assert nxt in {f"{concept}-P2", f"{concept}-P3"}
    fb = post(client, "asha", sib_id, sib_opt, key(sib_id)[1])  # wrong the same way on a sibling
    assert (fb["category"], fb["rule_fired"], fb["misconception_code"]) == ("MISCONCEPTION", "slip:5", code)
    assert fb["misconception_status"] == "SUSPECTED"

    why = client.get(f"/diagnosis/{fb['response_id']}/why").json()
    assert why["rule_fired"] == "slip:5" and why["distractor_map_entry"] == {sib_opt: code}
    assert "classifier_confidence" in why


def test_typed_text_never_changes_mastery(client):
    before = client.get("/mastery/ben").json()["concepts"][1]
    fb = post(client, "ben", "C2-P1", key("C2-P1")[0], text="I understand")
    assert fb["category"] == "AMBIGUOUS" and fb["needs_clarification"]
    rid = fb["response_id"]
    assert client.post("/clarify", json={"response_id": rid, "text": "I understand it now"}).json()["category"] == "AMBIGUOUS"
    assert client.post("/clarify", json={"response_id": rid, "text": "yes really"}).json()["category"] == "UNDIAGNOSED"
    after = client.get("/mastery/ben").json()["concepts"][1]
    assert after == before
    assert client.post("/clarify", json={"response_id": rid, "text": "again"}).status_code == 409


def test_clarify_with_reason_option_resolves(client):
    opt, rid = key("C3-P1")
    fb = post(client, "cara", "C3-P1", opt, text="because waves")
    assert fb["clarify"]["reasons"]
    fb = client.post("/clarify", json={"response_id": fb["response_id"], "reason_id": rid}).json()
    assert fb["category"] == "SCIENTIFIC" and fb["mastery"]["p_learned"] == pytest.approx(0.7875, abs=0.001)


def test_bkt_through_api_reaches_mastery(client):
    ps = [post(client, "dev", f"C1-P{n}", *key(f"C1-P{n}"))["mastery"]["p_learned"] for n in (1, 2, 3)]
    assert ps[:2] == pytest.approx([0.787, 0.975], abs=0.001)
    c1 = client.get("/mastery/dev").json()["concepts"][0]
    assert (c1["attempts"], c1["distinct_items"], c1["mastered"]) == (3, 3, True)
    assert client.get("/items/next", params={"learner_id": "dev"}).json()["item"]["concept"] == "C2"


def test_next_item_can_be_limited_to_a_concept(client):
    item = client.get("/items/next", params={"learner_id": "fay", "concept": "C6"}).json()["item"]
    assert item["concept"] == "C6"
    assert client.get("/items/next", params={"learner_id": "fay", "concept": "C99"}).json()["item"] is None


def test_assessment_items_rejected_from_practice(client):
    res = client.post("/responses", json={"learner_id": "eve", "item_id": "C1-A1", "option": "A",
                                          "reason_id": "r1", "confidence": "sure"})
    assert res.status_code == 409


def test_explain_and_concepts(client):
    assert client.get("/explain/S4-R").json()["code"] == "S4"
    assert client.get("/explain/nope").status_code == 404
    assert len(client.get("/concepts").json()) == 7
