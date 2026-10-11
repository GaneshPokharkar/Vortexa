from api.content import load_content


def test_data_files_match_schema():
    c = load_content()  # raises on any schema or cross-reference error
    assert [x.concept_id for x in c.concepts] == [f"C{i}" for i in range(1, 10)]
    expected = {f"{p}{n}" for p, k in [("O", 5), ("W", 5), ("B", 2), ("R", 6), ("L", 5)] for n in range(1, k + 1)}
    assert set(c.misconceptions) == expected
    for concept in c.concepts:
        assert sum(i.concept == concept.concept_id for i in c.items.values()) >= 2
        assert any(card.concept == concept.concept_id for card in c.cards.values())
