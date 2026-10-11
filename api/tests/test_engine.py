import pytest

from api.content import Item
from api.engine import (
    bkt_update, content_word_count, grade, is_mastered, is_sibling, misconception_status, needs_clarification, slip_rules,
)

# A = correct, B -> W1, C -> UNMAPPED, D -> SLIP (careless number). r1 correct, r2 W1, r3 W2.
ITEM = Item(
    item_id="T1", concept="C3", stem="stem",
    options={"A": "a", "B": "b", "C": "c", "D": "d"}, correct="A",
    distractor_map={"A": "CORRECT", "B": "W1", "C": "UNMAPPED", "D": "SLIP"},
    reasons={"r1": {"text": "x", "maps_to": "CORRECT"}, "r2": {"text": "y", "maps_to": "W1"},
             "r3": {"text": "z", "maps_to": "W2"}},
)


# --- three-tier table: one test per category ---------------------------------

def test_scientific():
    assert grade(ITEM, "A", "r1", "sure").category == "SCIENTIFIC"

def test_fragile():
    assert grade(ITEM, "A", "r1", "unsure").category == "FRAGILE"

def test_false_positive_counts_incorrect():
    g = grade(ITEM, "A", "r2", "sure")
    assert (g.category, g.misconception_code, g.counts_correct) == ("FALSE_POSITIVE", "W1", False)

def test_misconception():
    g = grade(ITEM, "B", "r2", "sure")
    assert (g.category, g.misconception_code) == ("MISCONCEPTION", "W1")

def test_lack_of_knowledge():
    g = grade(ITEM, "B", "r2", "unsure")
    assert (g.category, g.misconception_code) == ("LACK_OF_KNOWLEDGE", None)

def test_slip():
    assert grade(ITEM, "B", "r1", "sure").category == "SLIP"

def test_ambiguous_unclassifiable():
    assert grade(ITEM, "A", None, "sure").category == "AMBIGUOUS"          # correct answer, no reason
    assert grade(ITEM, "C", "r2", "sure", p_learned=0.5).category == "AMBIGUOUS"  # unmapped option, low P(L)


# --- slip rules ---------------------------------------------------------------

def test_slip_rule_1_wrong_answer_correct_reason():
    assert slip_rules("W1", "CORRECT", 0.0) == ("SLIP", "slip:1")
    assert grade(ITEM, "B", "r1", "unsure").rule_fired == "slip:1"

def test_slip_rule_2_high_pl_unmapped():
    assert grade(ITEM, "C", "r2", "sure", p_learned=0.80).category == "SLIP"
    assert grade(ITEM, "C", "r2", "sure", p_learned=0.80).rule_fired == "slip:2"
    assert slip_rules("UNMAPPED", "W1", 0.79) is None

def test_slip_rule_3_computational():
    assert grade(ITEM, "D", "r1", "sure").category == "COMPUTATIONAL_SLIP"
    assert grade(ITEM, "D", None, "sure").rule_fired == "slip:3"

def test_slip_rule_4_code_mismatch():
    g = grade(ITEM, "B", "r3", "sure")
    assert (g.category, g.rule_fired) == ("AMBIGUOUS", "slip:4")

def test_slip_rule_5_slips_schedule_sibling():
    assert grade(ITEM, "B", "r1", "sure").schedule_sibling
    assert grade(ITEM, "D", "r1", "sure").schedule_sibling
    assert not grade(ITEM, "B", "r2", "sure").schedule_sibling
    assert not grade(ITEM, "A", "r1", "sure").schedule_sibling

def test_slip_rule_5_same_wrong_way_on_sibling_upgrades():
    g = grade(ITEM, "B", "r1", "sure", prior_slip_code="W1")  # slipped on W1 before, picks W1 again
    assert (g.category, g.rule_fired, g.misconception_code) == ("MISCONCEPTION", "slip:5", "W1")
    assert grade(ITEM, "B", "r1", "sure", prior_slip_code="W2").category == "SLIP"  # different wrong way
    assert grade(ITEM, "A", "r1", "sure", prior_slip_code="W1").category == "SCIENTIFIC"  # right this time
    assert grade(ITEM, "C", "r1", "sure", prior_slip_code="UNMAPPED").category == "SLIP"  # nothing to upgrade to

def test_is_sibling():
    parent = ITEM.model_copy(update={"item_id": "P1"})
    child_a = ITEM.model_copy(update={"item_id": "P2", "sibling_of": "P1"})
    child_b = ITEM.model_copy(update={"item_id": "P3", "sibling_of": "P1"})
    other = ITEM.model_copy(update={"item_id": "X1"})
    assert is_sibling(parent, child_a) and is_sibling(child_a, parent) and is_sibling(child_a, child_b)
    assert not is_sibling(parent, other) and not is_sibling(parent, parent)


# --- misconception status -----------------------------------------------------

def test_suspected_then_confirmed_by_second_item():
    assert misconception_status([]) == "NONE"
    assert misconception_status([("C3-P1", None)]) == "SUSPECTED"
    assert misconception_status([("C3-P1", None), ("C3-P1", None)]) == "SUSPECTED"  # same item twice
    assert misconception_status([("C3-P1", None), ("C3-P2", None)]) == "CONFIRMED"

def test_confirmed_by_classifier_on_one_item():
    assert misconception_status([("C3-P1", 0.74)]) == "SUSPECTED"
    assert misconception_status([("C3-P1", 0.75)]) == "CONFIRMED"


# --- clarification thresholds -------------------------------------------------

@pytest.mark.parametrize("top1,top2,words,contra,expected", [
    (0.90, 0.10, 10, False, False),  # clear
    (0.59, 0.10, 10, False, True),   # top1 < 0.60
    (0.60, 0.10, 10, False, False),  # top1 boundary
    (0.80, 0.66, 10, False, True),   # margin 0.14 < 0.15
    (0.80, 0.64, 10, False, False),  # margin 0.16
    (0.90, 0.10, 5, False, True),    # word_count < 6
    (0.90, 0.10, 6, False, False),   # word_count boundary
    (0.90, 0.10, 10, True, True),    # contradiction
])
def test_needs_clarification(top1, top2, words, contra, expected):
    assert needs_clarification(top1, top2, words, contra) is expected

def test_content_words_ignore_filler():
    assert content_word_count("I understand") == 0
    assert content_word_count("um I think it's just, like, the heavier bob") == 3  # it's, heavier, bob
    assert content_word_count("Mass does not change the period of a pendulum") == 5


# --- BKT ----------------------------------------------------------------------

def test_bkt_pinned_sequence():
    p = 0.25
    for correct, expected in [(True, 0.787), (True, 0.975), (False, 0.842)]:
        p = bkt_update(p, correct)
        assert p == pytest.approx(expected, abs=0.001)

def test_mastered_requires_every_condition():
    assert is_mastered(0.96, 3, 2, True, False)
    assert not is_mastered(0.94, 3, 2, True, False)
    assert not is_mastered(0.96, 2, 2, True, False)
    assert not is_mastered(0.96, 3, 1, True, False)
    assert not is_mastered(0.96, 3, 2, False, False)
    assert not is_mastered(0.96, 3, 2, True, True)
