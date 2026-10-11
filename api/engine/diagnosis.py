"""Misconception status + clarification thresholds. Pure functions, no I/O."""
from __future__ import annotations

from typing import Literal, Optional

Status = Literal["NONE", "SUSPECTED", "CONFIRMED"]

CLASSIFIER_CONFIRM = 0.75
MAX_CLARIFICATIONS = 2


def misconception_status(evidence: list[tuple[str, Optional[float]]]) -> Status:
    """evidence: (item_id, classifier_score or None) for each mapped response with this code."""
    if not evidence:
        return "NONE"
    if len({item_id for item_id, _ in evidence}) >= 2:
        return "CONFIRMED"
    if any(score is not None and score >= CLASSIFIER_CONFIRM for _, score in evidence):
        return "CONFIRMED"
    return "SUSPECTED"


STOP_WORDS = frozenset(
    "a an the is are was were be been am i me my it its this that these those to of in on at by for with and or "
    "but so if then than as do does did yes just very really because think know understand guess maybe "
    "um uh like you he she they we our your their there here what which who how why".split()
)


def content_word_count(text: str) -> int:
    """Words that carry meaning: 'I understand it' has 0, 'the heavier bob swings slower' has 4."""
    words = (w.strip(".,!?;:'\"()").lower() for w in text.split())
    return sum(1 for w in words if w and w not in STOP_WORDS)


def needs_clarification(top1: float, top2: float, word_count: int, contradiction: bool) -> bool:
    return top1 < 0.60 or (top1 - top2) < 0.15 or word_count < 6 or contradiction
