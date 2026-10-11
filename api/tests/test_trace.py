"""Mistake tracer: computed wrong paths for numeric questions, matched against the student's number."""
import pytest
from fastapi.testclient import TestClient

from api.content import load_content
from api.engine import trace
from api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def say(client, learner, item_id, text):
    res = client.post("/responses", json={"learner_id": learner, "item_id": item_id, "answer_text": text})
    assert res.status_code == 200, res.text
    return res.json()


def traced_items():
    return [i for i in load_content().items.values() if i.trace]


def test_every_traced_formula_gives_the_answer_and_no_path_gives_it():
    assert len([i for i in traced_items() if i.kind == "short"]) == 6
    for i in (i for i in traced_items() if i.kind == "short"):
        assert abs(trace.right_answer(i.trace) - i.numeric.value) <= i.numeric.tolerance, i.item_id
        assert all(abs(p.value - i.numeric.value) > i.numeric.tolerance for p in trace.paths(i.trace)), i.item_id


def test_a_number_from_a_wrong_idea_is_diagnosed_as_that_idea(client):
    fb = say(client, "tr-idea", "C5-Q2", "E = 0.25 J")  # used x instead of A: thinks total energy depends on position
    assert (fb["category"], fb["misconception_code"], fb["rule_fired"]) == ("MISCONCEPTION", "S13", "short:numeric-trace")
    assert any("mistake tracer" in e for e in fb["evidence"])
    assert fb["trace"]["checked"] == len(trace.paths(load_content().items["C5-Q2"].trace))
    assert len(fb["trace"]["matched"]) == 1


def test_a_number_from_two_careless_steps_is_a_slip(client):
    fb = say(client, "tr-slip", "C5-Q2", "20 J")  # dropped the ½ and forgot to square A
    assert (fb["category"], fb["rule_fired"]) == ("COMPUTATIONAL_SLIP", "short:numeric-trace")
    assert "left out the ½ and used A instead of A²" in fb["evidence"][0]


def test_one_number_two_stories_is_ambiguous_not_guessed():
    m = trace.match(load_content().items["C7-Q1"].trace, [8.57])
    assert m and m.unique is None and len(m.paths) == 2


def test_an_unrelated_number_is_not_forced_onto_a_path(client):
    fb = say(client, "tr-none", "C5-Q2", "7 J")
    assert fb["rule_fired"] == "short:numeric-unmatched" and fb["trace"]["number"] is None


def test_the_step_check_uses_the_traced_habit(client):
    fb = say(client, "tr-step", "C3-Q2", "T = 2π/10 = 0.628 s")  # forgot the π in ω = 10π: an ARITH slip
    assert fb["category"] == "COMPUTATIONAL_SLIP"
    out = client.post(f"/responses/{fb['response_id']}/step", json={"step": 1}).json()["step_check"]
    assert out["traced"] is not None and load_content().items["C3-Q2"].steps[out["traced"] - 1].habit == "ARITH"


def test_every_numeric_option_comes_from_exactly_one_matching_mistake():
    mcq = [i for i in traced_items() if i.kind == "mcq"]
    assert len(mcq) == 5
    for i in mcq:
        for opt in i.trace["option_values"]:
            path, code = trace.option_path(i.trace, opt), i.distractor_map[opt]
            assert path is not None, (i.item_id, opt)
            assert code in path.tags or (code == "SLIP" and set(path.tags) & trace.HABITS), (i.item_id, opt, path.tags)


def test_a_numeric_option_names_its_mistake_and_shows_the_tracer(client):
    it = load_content().items["C3-P2"]
    right = next(r for r, v in it.reasons.items() if v.maps_to == "CORRECT")
    fb = client.post("/responses", json={"learner_id": "tr-mcq", "item_id": "C3-P2", "option": "B",
                                         "reason_id": right, "confidence": "sure"}).json()
    assert any("left out the square root" in e for e in fb["evidence"])
    assert fb["trace"]["matched"][0]["tags"] == ["ROOT"]
