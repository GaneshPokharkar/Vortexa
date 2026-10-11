"""Course Q&A without Claude: shorthand is understood and every concept's material is searched."""
from api import tutor


def test_shorthand_question_on_another_concept_page_is_answered_from_c2():
    r = tutor.ask("C1", "why the acc is 0")
    assert r["grounded_in"] and r["grounded_in"][0].startswith("C2-") and not r["refer_teacher"]
    assert r["answer"].startswith("(From Velocity and acceleration in SHM)")


def test_own_concept_material_is_not_labelled_as_from_elsewhere():
    r = tutor.ask("C1", "what is amplitude")
    assert r["grounded_in"][0].startswith("C1-") and not r["answer"].startswith("(From")


def test_off_course_question_is_referred_to_the_teacher():
    r = tutor.ask("C1", "who won the cricket match")
    assert r["grounded_in"] == [] and r["refer_teacher"]
