"""Bayesian Knowledge Tracing per concept. Pure functions, no I/O."""
from __future__ import annotations

P_L0 = 0.25
T = 0.15  # learn
G = 0.10  # guess (answer + reason both right by chance)
S = 0.10  # slip
MASTERY_P = 0.95


def bkt_update(p: float, correct: bool, t: float = T, g: float = G, s: float = S) -> float:
    if correct:
        posterior = p * (1 - s) / (p * (1 - s) + (1 - p) * g)
    else:
        posterior = p * s / (p * s + (1 - p) * (1 - g))
    return posterior + (1 - posterior) * t


def is_mastered(p: float, attempts: int, distinct_items: int, last_correct: bool, confirmed_active: bool) -> bool:
    return p >= MASTERY_P and attempts >= 3 and distinct_items >= 2 and last_correct and not confirmed_active
