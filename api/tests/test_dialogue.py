"""Socratic dialogue with a confused peer, and the teacher's class misconception map."""
import pytest
from fastapi.testclient import TestClient

from api.ai import llm
from api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def start(client, learner, concept="C2", code="S4"):
    res = client.post("/dialogues", json={"learner_id": learner, "concept": concept, "code": code})
    assert res.status_code == 200, res.text
    return res.json()


def say(client, dlg, text):
    res = client.post(f"/dialogues/{dlg['dialogue_id']}/turns", json={"text": text})
    assert res.status_code == 200, res.text
    return res.json()


def test_peer_opens_with_the_misconception_and_a_question(client):
    d = start(client, "d1")
    assert d["peer_name"] == "Rohan" and d["code"] == "S4" and d["status"] == "open"
    assert d["turns"][0]["role"] == "peer" and "convince me" in d["turns"][0]["text"]
    assert "Demo dialogue" in d["engine_note"]


def test_agreeing_with_rohan_flags_the_idea_and_he_pushes_back(client):
    d = start(client, "d2")
    d = say(client, d, "Yes, it is fastest at the extreme position because that is the farthest point")
    student, peer = d["turns"][-2], d["turns"][-1]
    assert student["flagged_code"] == "S4" and student["group"] == "B" and student["pipeline"]
    assert peer["role"] == "peer" and d["status"] == "open" and d["turns_left"] == 4


def test_a_convincing_explanation_resolves_the_dialogue(client):
    d = start(client, "d3")
    d = say(client, d, "No, it is fastest at the mean position, because the restoring force is zero there and all the energy is kinetic")
    assert d["status"] == "resolved" and d["turns"][-2]["group"] == "A"
    assert "convinced" in d["turns"][-1]["text"].lower()
    assert client.post(f"/dialogues/{d['dialogue_id']}/turns", json={"text": "more"}).status_code == 409


def test_vague_reply_gets_a_why_question_and_five_misses_go_to_the_teacher(client):
    d = start(client, "d4")
    d = say(client, d, "At the centre, I think")
    assert d["turns"][-2]["group"] == "D" and "why" in d["turns"][-1]["text"].lower()
    for _ in range(4):
        d = say(client, d, "It is constant everywhere")
    assert d["status"] == "unresolved" and "teacher" in d["turns"][-1]["text"].lower()


def test_dialogue_never_changes_mastery(client):
    before = client.get("/mastery/d5").json()
    d = start(client, "d5")
    say(client, d, "No, it is fastest at the mean position, because the restoring force is zero there and all the energy is kinetic")
    assert client.get("/mastery/d5").json() == before


def test_rohan_takes_the_learners_own_flagged_idea(client):
    client.post("/responses", json={"learner_id": "d6", "item_id": "C2-Q1", "answer_text": "It is constant everywhere."})
    d = client.post("/dialogues", json={"learner_id": "d6", "concept": "C2"}).json()
    assert d["code"] == "S5"


def test_claude_writes_rohans_lines_when_live_and_script_takes_over_on_failure(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    monkeypatch.setattr(llm, "evaluate", lambda item, text: None)
    monkeypatch.setattr(llm, "peer_line", lambda *a, **k: "Arre, but it stops at the ends, so how can it be fast there?")
    d = start(client, "d7")
    assert d["turns"][0]["engine"] == "claude" and "Claude" in d["engine_note"]
    monkeypatch.setattr(llm, "peer_line", lambda *a, **k: None)
    d = say(client, d, "It is constant everywhere")
    assert d["turns"][-1]["engine"] == "rules"


def test_peer_lines_with_invented_numbers_are_rejected(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    monkeypatch.setattr(llm, "_json_call", lambda *a, **k: {"line": "It must be 42 m/s at the ends, trust me."})
    assert llm.peer_line("push", "fast at ends", [], "Where is speed maximum?", "v = Aω at the mean", []) is None


def test_teacher_map_shows_flags_quotes_and_resolution(client, monkeypatch):
    monkeypatch.setenv("LEARNLOOP_REVIEWER_TOKEN", "t0ken")
    assert client.get("/teacher/map").status_code == 401
    # d2 agreed with Rohan (S4 active); d3 convinced Rohan without ever being flagged.
    m = client.get("/teacher/map", headers={"X-Reviewer-Token": "t0ken"}).json()
    c2 = next(c for c in m["concepts"] if c["concept"] == "C2")
    s4 = next(x for x in c2["misconceptions"] if x["code"] == "S4")
    assert s4["active"] >= 1
    flagged = [s for s in m["students"] if any(f["code"] == "S4" for f in s["flags"])]
    assert flagged and all(s["label"].startswith("Learner") or s["is_demo"] for s in m["students"])
    f = next(f for s in flagged for f in s["flags"] if f["code"] == "S4")
    assert f["quote"] and f["source"] in ("dialogue", "practice")
    # Resolve: a flagged learner later convinces Rohan.
    d = start(client, "d8")
    say(client, d, "Yes, it is fastest at the extreme position because that is the farthest point")
    say(client, d, "Actually no, it is fastest at the mean position, because the restoring force is zero there and all the energy is kinetic")
    m = client.get("/teacher/map", headers={"X-Reviewer-Token": "t0ken"}).json()
    assert any(f["code"] == "S4" and f["status"] == "resolved" for s in m["students"] for f in s["flags"])
