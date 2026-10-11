# WaveLoop AI — Project Brief

Read this first in every build session.

## Context

- Hackathon: VORTEXA 3.0, 12 hours, problem E-01 "LearnLoop AI: Adaptive AI Tutor & Misconception Detector".
- Build: **WaveLoop AI**, one topic "Oscillations, Waves & Light" told as one story
  (SHM → mechanical waves → ray optics → wave optics), 9 concepts C1–C9.
- Organiser hard rules:
  - AI must be used meaningfully but must **not silently override explicit rules**.
  - Fictional data only.
  - No paid services required.
  - The core demo must work with external AI services switched off.
- Stack (locked): Python 3.11+, FastAPI, SQLite via SQLModel, Pydantic, pytest. Frontend later in `/web` (React 18 + Vite + TS + Tailwind).

## Layout

```
api/engine/   pure, typed rule functions — no I/O, no network, ever
api/content.py   loads + validates data/*.json
api/store.py     SQLite table + apply_response (the ONLY mastery writer)
api/main.py      FastAPI endpoints
api/tests/       pytest
data/            concepts, misconceptions, items, cards (JSON)
```

Run: `.venv/Scripts/python -m pytest` and `.venv/Scripts/uvicorn api.main:app --reload` (port 8000).

## Content schema

Codes used in maps: a misconception code (`O1`…`L5`), `"CORRECT"`, `"SLIP"`, `"UNMAPPED"`.

- **items**: `item_id, concept, is_assessment, stem, options{A–D}, correct, distractor_map{option→code|"SLIP"|"UNMAPPED"}, reasons{r1–r3:{text, maps_to}}, sibling_of`
  - `distractor_map[correct]` must be `"CORRECT"`.
  - Exactly one reason has `maps_to: "CORRECT"`; the other two map to misconception codes.
  - `"SLIP"` on an option means "right method, careless number" (drives COMPUTATIONAL_SLIP).
  - `sibling_of`: item_id this item mirrors (served after a slip), or `null`.
  - Extra fields (`calc`, `verify_flags`, `status`) are allowed and ignored by the engine.
- **misconceptions**: `code, concept, description, exemplars[8+], remediation_card_id, followup_item_ids[], contrast_probe`
- **cards**: `card_id, concept, statement, worked_example, analogy, steps[], wrong_idea, why_wrong`
- Seed content is marked `"status": "TODO_VERIFY"`; the physics teammate replaces it and sets `"VERIFIED"`.
- `pytest` validates every data file against this schema (`api/tests/test_data.py`).

## Engine rules

### Three-tier grading — `grade(item, option, reason_id|None, confidence, p_learned)`

| Answer | Reason | Confidence | Category |
|---|---|---|---|
| correct | correct | sure | SCIENTIFIC |
| correct | correct | unsure | FRAGILE |
| correct | misconception | any | FALSE_POSITIVE (counts as incorrect for mastery) |
| mapped wrong | same code as option | sure | MISCONCEPTION |
| wrong | wrong | unsure | LACK_OF_KNOWLEDGE |
| wrong | correct | any | SLIP |
| contradiction / unclassifiable | | | AMBIGUOUS |

### Slip rules — `slip_rules()`, checked first for wrong answers, in this order

3. Option mapped `"SLIP"` and reason correct or absent → COMPUTATIONAL_SLIP
1. Wrong answer + correct reason → SLIP
2. P(L) ≥ 0.80 and option `"UNMAPPED"` → SLIP
4. Option code ≠ reason code (both misconception codes) → AMBIGUOUS
5. Every SLIP / COMPUTATIONAL_SLIP schedules one sibling item.

### Misconception status — `misconception_status(evidence)`

- SUSPECTED after 1 mapped response (MISCONCEPTION or FALSE_POSITIVE).
- CONFIRMED after evidence on ≥ 2 distinct item_ids, or 1 item + classifier match ≥ 0.75.

### Clarification — `needs_clarification(top1, top2, word_count, contradiction)`

True if top1 < 0.60, or top1 − top2 < 0.15, or word_count < 6, or contradiction.
Max 2 clarifications per item, then UNDIAGNOSED. AMBIGUOUS responses do not touch mastery until resolved;
UNDIAGNOSED responses never touch mastery (so free text can never move P(L)).

### BKT per concept

P(L0) = 0.25, T = 0.15, G = 0.10, S = 0.10. An observation is "correct" only for SCIENTIFIC or FRAGILE
(answer + reason scoring). Pinned test: correct → 0.787, correct → 0.975, wrong → 0.842.

**Mastered** only if P(L) ≥ 0.95 AND ≥ 3 attempts on ≥ 2 distinct items AND last attempt correct AND
no CONFIRMED misconception active for that concept.

### Single writer

Only `apply_response(response_id)` in `api/store.py` writes mastery. No endpoint changes mastery from free text.

## Endpoints

`GET /concepts`, `GET /items/next?learner_id=`, `POST /responses`, `POST /clarify`, `GET /mastery/{learner_id}`,
`GET /explain/{card_id}`, `GET /diagnosis/{response_id}/why`, `GET /health`.
Items are served without `correct`, `distractor_map` or reason `maps_to`.
