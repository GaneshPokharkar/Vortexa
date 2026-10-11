"""Deterministic grading of short free-text answers (typed or spoken). Pure, no I/O.

Order of evidence: numeric value → correct-answer phrases → misconception phrases → (optional) LLM hint → clarify.
A phrase only counts when it is not negated ("not at the end", "opposite to the direction of motion").
The LLM never decides: it may only propose a code from the item's own list, with a quote that must appear in
the answer, and its confidence goes through the same clarification thresholds as everything else.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from api.content import CORRECT, Item
from api.engine.diagnosis import content_word_count, needs_clarification

SUPERSCRIPT = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-")
NEGATORS = {"not", "no", "never", "isn't", "isnt", "doesn't", "doesnt", "nahi", "nahin", "without", "against"}
NEGATING_PHRASES = ("opposite to", "opposite of", "instead of", "rather than")
REASON_CUES = ("because", "since", "so that", "therefore", "as the", "due to", "kyunki")

# Generic physics vocabulary: an answer with none of these and no item phrase is treated as off-topic.
DOMAIN_WORDS = {
    "speed", "velocity", "acceleration", "force", "energy", "kinetic", "potential", "mean", "extreme", "amplitude",
    "period", "frequency", "omega", "mass", "spring", "pendulum", "displacement", "oscillat", "position", "zero",
    "maximum", "minimum", "centre", "center", "middle", "light", "ray", "lens", "image", "normal", "angle", "refract",
    "reflect", "critical", "focus", "focal", "screen", "glass", "water", "air", "index", "real", "virtual",
}


@dataclass(frozen=True)
class LlmHint:
    """A validated proposal from the language model (see api/ai/llm.py)."""
    label: str  # a code from the item's patterns, or "CORRECT", or "UNCLEAR"
    confidence: float
    second: float  # confidence of the runner-up label
    quote: str  # words copied from the answer that support the label
    reasoning_present: bool


@dataclass(frozen=True)
class ShortResult:
    category: str
    rule_fired: str
    code: Optional[str]
    evidence: list[str] = field(default_factory=list)
    confidence: Optional[float] = None
    follow_up_key: Optional[str] = None  # key into item.follow_ups
    engine: str = "rules"


def normalize(text: str) -> str:
    t = text.lower().translate(SUPERSCRIPT).replace("−", "-").replace("–", "-").replace("×", "x")
    return re.sub(r"\s+", " ", t).strip()


def _phrase_positions(text: str, phrase: str) -> list[int]:
    p = re.escape(normalize(phrase))
    return [m.start() for m in re.finditer(rf"(?<![\w.]){p}(?![\w])", text)]


def _negated(text: str, pos: int) -> bool:
    before = text[:pos]
    window = before.split()[-3:]
    if any(w.strip(".,!?'\"") in NEGATORS for w in window):
        return True
    tail = before[-20:]
    return any(n in tail for n in NEGATING_PHRASES)


def hits(text: str, phrases: list[str]) -> list[str]:
    """Phrases present in `text` (already normalized) and not negated."""
    return [ph for ph in phrases if any(not _negated(text, pos) for pos in _phrase_positions(text, ph))]


_NUM = re.compile(r"(?<![\w.])(-?\d+(?:\.\d+)?)(?:\s*(?:e|x\s*10\s*\^?|\*\s*10\s*\^?)\s*(-?\d+))?")


def parse_numbers(text: str) -> list[float]:
    """Numbers in the answer, including 2e8, 2 x 10^8 and 2 × 10⁸. '10.5' is never read as '0.5'."""
    return [float(m.group(1)) * 10 ** int(m.group(2)) if m.group(2) else float(m.group(1))
            for m in _NUM.finditer(normalize(text))]


def _quote(phrase: str) -> str:
    return f"“{phrase}”"


def grade_short(item: Item, text: str, confidence: str = "sure", llm: Optional[LlmHint] = None) -> ShortResult:
    t = normalize(text)
    words = content_word_count(text)
    codes_found: dict[str, list[str]] = {}
    for p in item.patterns:
        found = hits(t, p.any)
        if found:
            codes_found.setdefault(p.code, []).extend(found)

    # 1. Numeric answers: the number outranks keywords.
    if item.numeric:
        n = item.numeric
        nums = parse_numbers(t)
        if any(abs(x - n.value) <= n.tolerance for x in nums):
            reasoned = bool(hits(t, item.reasoning_any)) or any(c in t for c in REASON_CUES)
            cat = "SCIENTIFIC" if confidence == "sure" else "FRAGILE"
            return ShortResult(cat, "short:numeric-correct", None,
                               [f"Your value matches {n.value:g} {n.unit}".strip() + "."] +
                               (["You also explained the method."] if reasoned else []),
                               0.95, "CORRECT")
        for s in n.slips:
            if any(abs(x - s.value) <= n.tolerance for x in nums):
                return ShortResult("COMPUTATIONAL_SLIP", "short:numeric-slip", None,
                                   [f"Your value {s.value:g} {n.unit} is what you get if you {s.why.rstrip('.')}.".replace("  ", " "),
                                    "That looks like a slip in the working, not a wrong idea."],
                                   0.8, "UNCLEAR")
        if nums and not codes_found:
            return ShortResult("AMBIGUOUS", "short:numeric-unmatched", None,
                               [f"Your number ({nums[0]:g}) doesn't match the answer or a common slip."],
                               None, "UNCLEAR")

    accepted = hits(t, item.accept_any)
    reasoned = bool(hits(t, item.reasoning_any)) or (any(c in t for c in REASON_CUES) and words >= 6)

    # 2. Correct-answer phrase and a misconception phrase together: ask, don't guess.
    if accepted and codes_found:
        code_list = ", ".join(sorted(codes_found))
        return ShortResult("AMBIGUOUS", "short:contradiction", None,
                           [f"You said {_quote(accepted[0])}, which fits the correct answer,",
                            f"but also {_quote(next(iter(codes_found.values()))[0])}, which fits a different idea ({code_list})."],
                           None, "UNCLEAR")
    # 3. Correct answer.
    if accepted:
        if reasoned:
            cat = "SCIENTIFIC" if confidence == "sure" else "FRAGILE"
            ev = [f"You named the right answer ({_quote(accepted[0])})."]
            r = hits(t, item.reasoning_any)
            ev.append(f"Your reason mentions {_quote(r[0])}." if r else "You gave a reason.")
            return ShortResult(cat, "short:correct", None, ev, 0.9, "CORRECT")
        return ShortResult("PARTIAL", "short:correct-no-reason", None,
                           [f"You named the right answer ({_quote(accepted[0])}),", "but we can't see your reasoning yet."],
                           0.6, "CORRECT_NO_REASON")
    # 4. Exactly one misconception.
    if len(codes_found) == 1:
        code, found = next(iter(codes_found.items()))
        conf = min(0.9, 0.65 + 0.1 * len(found))
        return ShortResult("MISCONCEPTION", "short:pattern", code,
                           [f"You said {_quote(found[0])}, which matches a common wrong idea."], conf, code)
    if len(codes_found) > 1:
        return ShortResult("AMBIGUOUS", "short:two-codes", None,
                           [f"Your answer fits more than one wrong idea ({', '.join(sorted(codes_found))})."],
                           None, "UNCLEAR")

    # 5. Nothing matched: a validated LLM hint may supply evidence, under the same thresholds.
    if llm and llm.label != "UNCLEAR":
        if needs_clarification(llm.confidence, llm.second, max(words, 6), False):
            return ShortResult("AMBIGUOUS", "short:llm-unsure", None,
                               ["The tutor isn't confident enough to diagnose this answer."], llm.confidence, "UNCLEAR", "llm")
        if llm.label == CORRECT:
            if llm.reasoning_present:
                cat = "SCIENTIFIC" if confidence == "sure" else "FRAGILE"
                return ShortResult(cat, "short:llm-correct", None,
                                   [f"Your explanation ({_quote(llm.quote)}) matches the expected reasoning."],
                                   llm.confidence, "CORRECT", "llm")
            return ShortResult("PARTIAL", "short:llm-correct-no-reason", None,
                               [f"{_quote(llm.quote)} looks right, but the reasoning isn't clear yet."],
                               llm.confidence, "CORRECT_NO_REASON", "llm")
        return ShortResult("MISCONCEPTION", "short:llm", llm.label,
                           [f"You said {_quote(llm.quote)}, which suggests a common wrong idea."],
                           llm.confidence, llm.label, "llm")

    # 6. No usable evidence.
    if re.search(r"[ऀ-ॿ]", t):  # Devanagari (Marathi/Hindi): the English keyword rules can't judge it
        return ShortResult("AMBIGUOUS", "short:unmatched", None,
                           ["The tutor couldn't match this answer yet. Try saying it again, or in English."], None, "UNCLEAR")
    on_topic = any(w in t for w in DOMAIN_WORDS)
    if not on_topic or words == 0:
        return ShortResult("OFF_TOPIC", "short:off-topic", None,
                           ["This answer doesn't seem to be about the question."], None, "UNCLEAR")
    return ShortResult("AMBIGUOUS", "short:unmatched", None,
                       ["The tutor couldn't match this answer to the correct idea or a known wrong idea."], None, "UNCLEAR")
