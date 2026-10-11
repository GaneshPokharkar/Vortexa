"""Three-tier grading + slip rules. Pure functions, no I/O."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

from api.content import CORRECT, SLIP, UNMAPPED, Item

Confidence = Literal["sure", "unsure"]

SCIENTIFIC = "SCIENTIFIC"
FRAGILE = "FRAGILE"
FALSE_POSITIVE = "FALSE_POSITIVE"
MISCONCEPTION = "MISCONCEPTION"
LACK_OF_KNOWLEDGE = "LACK_OF_KNOWLEDGE"
SLIP_CAT = "SLIP"
COMPUTATIONAL_SLIP = "COMPUTATIONAL_SLIP"
AMBIGUOUS = "AMBIGUOUS"
UNDIAGNOSED = "UNDIAGNOSED"

SLIP_CATEGORIES = {SLIP_CAT, COMPUTATIONAL_SLIP}
# Answer + reason scoring: only these count as a correct BKT observation.
CORRECT_CATEGORIES = {SCIENTIFIC, FRAGILE}

RULES = {
    "tier:scientific": "Correct answer, correct reason, sure.",
    "tier:fragile": "Correct answer, correct reason, not sure.",
    "tier:false_positive": "Correct answer but the reason matches a misconception; counts as incorrect for mastery.",
    "tier:misconception": "Wrong option mapped to a misconception, reason has the same code, sure.",
    "tier:lack_of_knowledge": "Wrong answer, wrong reason, not sure.",
    "tier:unclassifiable": "The answer, reason and confidence do not fit any row of the table.",
    "slip:1": "Wrong answer with the correct reason: slip.",
    "slip:2": "P(L) >= 0.80 and the option is not linked to any misconception: slip.",
    "slip:3": "Option is the careless-number distractor and the setup (reason) was correct: computational slip.",
    "slip:4": "Option code and reason code point to different misconceptions: ambiguous.",
    "slip:5": "Wrong the same way again on the sibling item after a slip: upgraded to misconception.",
    "clarify:resolved": "Re-graded after the learner answered a clarification.",
    "clarify:limit": "Still unclear after 2 clarifications: undiagnosed.",
}


@dataclass(frozen=True)
class Grade:
    category: str
    rule_fired: str
    option_code: str
    reason_code: Optional[str]
    misconception_code: Optional[str] = None

    @property
    def schedule_sibling(self) -> bool:
        """Slip rule 5: every slip schedules one sibling item."""
        return self.category in SLIP_CATEGORIES

    @property
    def counts_correct(self) -> bool:
        return self.category in CORRECT_CATEGORIES


def _is_code(code: Optional[str]) -> bool:
    return code not in (None, CORRECT, SLIP, UNMAPPED)


def slip_rules(option_code: str, reason_code: Optional[str], p_learned: float) -> Optional[tuple[str, str]]:
    """Slip rules 1-4 for a wrong answer. Returns (category, rule) or None if no rule fires."""
    if option_code == SLIP and reason_code in (CORRECT, None):
        return COMPUTATIONAL_SLIP, "slip:3"
    if reason_code == CORRECT:
        return SLIP_CAT, "slip:1"
    if option_code == UNMAPPED and p_learned >= 0.80:
        return SLIP_CAT, "slip:2"
    if _is_code(option_code) and _is_code(reason_code) and option_code != reason_code:
        return AMBIGUOUS, "slip:4"
    return None


def is_sibling(a: Item, b: Item) -> bool:
    """Siblings share an idea: one points at the other, or both point at the same parent."""
    if a.item_id == b.item_id:
        return False
    return a.sibling_of == b.item_id or b.sibling_of == a.item_id or (a.sibling_of is not None and a.sibling_of == b.sibling_of)


def grade(
    item: Item,
    option: str,
    reason_id: Optional[str],
    confidence: Confidence,
    p_learned: float = 0.0,
    prior_slip_code: Optional[str] = None,
) -> Grade:
    """prior_slip_code: option code of the slip that scheduled this sibling item (slip rule 5 upgrade)."""
    option_code = item.distractor_map[option]
    reason_code = item.reasons[reason_id].maps_to if reason_id else None

    if option == item.correct:
        if reason_code == CORRECT:
            if confidence == "sure":
                return Grade(SCIENTIFIC, "tier:scientific", option_code, reason_code)
            return Grade(FRAGILE, "tier:fragile", option_code, reason_code)
        if _is_code(reason_code):
            return Grade(FALSE_POSITIVE, "tier:false_positive", option_code, reason_code, reason_code)
        return Grade(AMBIGUOUS, "tier:unclassifiable", option_code, reason_code)

    if _is_code(prior_slip_code) and option_code == prior_slip_code:
        return Grade(MISCONCEPTION, "slip:5", option_code, reason_code, option_code)
    fired = slip_rules(option_code, reason_code, p_learned)
    if fired:
        return Grade(fired[0], fired[1], option_code, reason_code)
    if reason_code is not None and confidence == "unsure":
        return Grade(LACK_OF_KNOWLEDGE, "tier:lack_of_knowledge", option_code, reason_code)
    if _is_code(option_code) and reason_code == option_code:
        return Grade(MISCONCEPTION, "tier:misconception", option_code, reason_code, option_code)
    return Grade(AMBIGUOUS, "tier:unclassifiable", option_code, reason_code)
