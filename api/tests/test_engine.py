import pytest

from api.content import Item
from api.engine import bkt_update, grade, is_mastered, misconception_status, needs_clarification, slip_rules

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
    assert grade(ITEM, "B", "r1", "unsure").rule == "slip:1"

def test_slip_rule_2_high_pl_unmapped():
    assert grade(ITEM, "C", "r2", "sure", p_learned=0.80).category == "SLIP"
    assert grade(ITEM, "C", "r2", "sure", p_learned=0.80).rule == "slip:2"
    assert slip_rules("UNMAPPED", "W1", 0.79) is None

def test_slip_rule_3_computational():
    assert grade(ITEM, "D", "r1", "sure").category == "COMPUTATIONAL_SLIP"
    assert grade(ITEM, "D", None, "sure").rule == "slip:3"

def test_slip_rule_4_code_mismatch():
    g = grade(ITEM, "B", "r3", "sure")
    assert (g.category, g.rule) == ("AMBIGUOUS", "slip:4")

def test_slip_rule_5_slips_schedule_sibling():
    assert grade(ITEM, "B", "r1", "sure").schedule_sibling
    assert grade(ITEM, "D", "r1", "sure").schedule_sibling
    assert not grade(ITEM, "B", "r2", "sure").schedule_sibling
    assert not grade(ITEM, "A", "r1", "sure").schedule_sibling


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
