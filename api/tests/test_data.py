from api.content import load_content
from scripts.validate_content import validate

CODES = {
    "C1": {"O1", "O2", "O3"}, "C2": {"O4", "O5"}, "C3": {"W1", "W2", "W3"}, "C4": {"W4", "W5", "B1", "B2"},
    "C5": {"R1", "R2"}, "C6": {"R3", "R4"}, "C7": {"R5", "R6"}, "C8": {"L1", "L2", "L3"}, "C9": {"L4", "L5"},
}


def test_content_is_valid():
    assert validate() == []


def test_code_list_matches_brief():
    c = load_content()
    assert [x.concept_id for x in c.concepts] == list(CODES)
    for concept, codes in CODES.items():
        assert {m.code for m in c.misconceptions.values() if m.concept == concept} == codes
