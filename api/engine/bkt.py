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


# ---- Learner-facing mastery status (the single, editable place these rules live) ----
MIN_EVIDENCE = 2  # fewer answered questions than this => "Not enough evidence yet"
DEVELOPING_P = 0.60


def mastery_status(p: float, attempts: int, distinct_items: int, last_correct: bool,
                   transfer_correct: bool, confirmed: list[str]) -> tuple[str, str, bool]:
    """(status, plain-language reason, enough_evidence). Never upgrades on self-report: inputs are attempt counts."""
    if attempts == 0:
        return "not_assessed", "No answers yet.", False
    if attempts < MIN_EVIDENCE:
        return "emerging", f"Not enough evidence yet: {attempts} answer so far.", False
    if confirmed:
        return "emerging" if p < DEVELOPING_P else "developing", \
            f"A wrong idea ({', '.join(confirmed)}) showed up on two different questions; that needs fixing first.", True
    if is_mastered(p, attempts, distinct_items, last_correct, False):
        if transfer_correct:
            return "demonstrated", (f"Correct on {distinct_items} different questions including an application "
                                    f"question, last answer right, P(L) {p:.2f}."), True
        return "developing", "Strong so far, but a correct answer on an application (transfer) question is still needed.", True
    if p >= DEVELOPING_P:
        return "developing", f"Getting there: P(L) {p:.2f} after {attempts} answers; mastery needs {MASTERY_P:.2f} " \
                             f"on at least 2 different questions with the last one right.", True
    return "emerging", f"Early days: P(L) {p:.2f} after {attempts} answers.", True
