from api.content import load_content
from scripts.validate_content import validate

CODES = {
    "C1": {"S1", "S2", "S3"}, "C2": {"S4", "S5", "S6", "S7"}, "C3": {"S8", "S9", "S10"}, "C4": {"S11", "S12"},
    "C5": {"S13", "S14", "S15"}, "C6": {"R3", "R4"}, "C7": {"R5", "R6"},
}


def test_content_is_valid():
    assert validate() == []


def test_code_list_matches_brief():
    c = load_content()
    assert [x.concept_id for x in c.concepts] == list(CODES)
    for concept, codes in CODES.items():
        assert {m.code for m in c.misconceptions.values() if m.concept == concept} == codes


def test_every_short_item_accepts_its_own_model_answer():
    """The answer key plus expected reasoning must grade as correct: catches keyword lists that miss their own key."""
    from api.engine.short import grade_short
    for i in load_content().items.values():
        if i.kind == "short":
            r = grade_short(i, f"{i.answer_key} {i.expected_reasoning}")
            assert r.category in ("SCIENTIFIC", "FRAGILE"), (i.item_id, r.category, r.rule_fired, r.evidence)
