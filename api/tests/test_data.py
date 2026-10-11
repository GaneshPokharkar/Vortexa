from api.content import load_content

CODES = {
    "C1": {"O1", "O2", "O3"}, "C2": {"O4", "O5"}, "C3": {"W1", "W2", "W3"}, "C4": {"W4", "W5", "B1", "B2"},
    "C5": {"R1", "R2"}, "C6": {"R3", "R4"}, "C7": {"R5", "R6"}, "C8": {"L1", "L2", "L3"}, "C9": {"L4", "L5"},
}


def test_data_files_match_content_model():
    c = load_content()  # raises on any schema or cross-reference error
    assert [x.concept_id for x in c.concepts] == list(CODES)
    for concept, codes in CODES.items():
        assert {m.code for m in c.misconceptions.values() if m.concept == concept} == codes
        items = [i for i in c.items.values() if i.concept == concept]
        assert sum(not i.is_assessment for i in items) == 3 and sum(i.is_assessment for i in items) == 1
        assert f"{concept}-K" in c.cards
        assert all(f"{code}-R" in c.cards for code in codes)
