# WaveLoop AI — Project Brief

Read this first in every build session. It is the single source of truth for scope and rules.

## Context

- Solo build at VORTEXA 3.0 (12 hours), problem E-01 "LearnLoop AI: Adaptive AI Tutor & Misconception Detector".
- **WaveLoop AI**: a voice-first physics tutor for ONE topic, "Oscillations, Waves & Light", told as one story:
  SHM → mechanical waves → ray optics → wave optics (Class 11–12, NCERT).
- Organiser rules — never break:
  - Working software, tested live by judges; reproducible with one command.
  - AI is used meaningfully (classification/adaptation, not a chatbot), but **explicit rules decide every outcome**;
    AI never silently overrides them.
  - Fictional data only. No paid service required. The full demo works with the internet OFF.
  - The tutor supports teachers; it never claims to replace them.
- Sponsor: ElevenLabs (speech-to-text for students explaining reasoning aloud; text-to-speech for the tutor voice).
  `ELEVENLABS_API_KEY` lives in `api/.env` — never print it, never send it to the browser.
- One person: keep everything small, working and tested before adding anything.

## Stack (locked)

- `/api`: Python 3.11-compatible (dev venv runs 3.13), FastAPI, SQLModel on SQLite, Pydantic, pytest, httpx,
  python-dotenv, sentence-transformers (all-MiniLM-L6-v2, CPU).
- `/web`: React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion + Recharts + react-router-dom + Vitest.
- Simulations: plain HTML canvas + requestAnimationFrame + Web Audio API.
- No other libraries. No Docker, no auth, no Ollama.

## Content model

| Concept | Misconception codes |
|---|---|
| C1 SHM period | O1 bigger swing takes longer · O2 bigger swing is faster so finishes first · O3 heavier bob changes period |
| C2 SHM v, a, energy | O4 zero velocity means zero acceleration at the extreme · O5 total energy changes during the swing |
| C3 waves as chained SHM, wave speed | W1 medium travels with the wave · W2 higher frequency → faster wave · W3 bigger amplitude → faster wave |
| C4 superposition, standing waves, beats | W4 overlapping pulses destroy each other · W5 pulses bounce off each other · B1 beat frequency = f1+f2 · B2 beat frequency = average of f1 and f2 |
| C5 reflection, mirrors | R1 stepping back from a plane mirror shows more of you · R2 image is on the mirror surface |
| C6 refraction, TIR | R3 light always bends toward the normal · R4 TIR can happen at any angle or direction |
| C7 lenses | R5 covering half a lens cuts off half the image · R6 a real image exists only with a screen |
| C8 Young's double slit | L1 closer slits give narrower fringes · L2 interference creates or destroys energy · L3 covering one slit leaves half the pattern |
| C9 diffraction, polarization | L4 narrower slit gives narrower central maximum · L5 adding a polarizer can never increase transmitted light |

Solo scope: 3 practice items + 1 assessment item per concept (27 practice, a fixed 9-item pre/post form),
1 concept card per concept (`<concept>-K`), 1 remediation card per code (`<code>-R`).

### Schemas (`data/*.json`)

Option/reason codes: a misconception code, `"CORRECT"`, `"SLIP"` (right method, careless number), `"UNMAPPED"`.

- **items**: `item_id, concept, is_assessment, sibling_of, stem, options{A–D}, correct,
  distractor_map{A–D → code | "CORRECT" | "SLIP" | "UNMAPPED"}, reasons{r1–r3:{text, maps_to}}, calc, verify_flags[]`
  - Exactly one option and exactly one reason map to `"CORRECT"`; the other reasons map to codes.
  - IDs `<concept>-P1..P3` (practice) and `<concept>-A1` (assessment). P2 and P3 set `sibling_of: "<concept>-P1"`.
- **misconceptions**: `code, concept, description, exemplars[12 student-style phrasings], remediation_card_id,
  followup_item_ids[], contrast_probe, verify_flags[]`
- **cards**: `card_id, concept, statement, analogy, steps[], worked_example, wrong_idea, why_wrong` plus, for
  remediation cards, `code, why_it_feels_right, sim_moment`; `verify_flags[]`.
- `concepts.json`: `concept_id, name, zone, summary`. Zones: Oscillations, Waves, Rays, Light as a wave.
- Anything not fully verified carries `"TODO_VERIFY"` (or a specific note) in `verify_flags`.

## Rules (all in `api/engine/`, pure and typed, no I/O)

### Three-tier grading — answer, reason, confidence (Sure / Not sure)

| Answer | Reason | Confidence | Category |
|---|---|---|---|
| correct | correct | sure | SCIENTIFIC |
| correct | correct | unsure | FRAGILE |
| correct | misconception | any | FALSE_POSITIVE (counts as wrong for mastery) |
| mapped wrong | same code as option | sure | MISCONCEPTION |
| wrong | wrong | unsure | LACK_OF_KNOWLEDGE |
| wrong | correct | any | SLIP |
| contradiction / unclassifiable | | | AMBIGUOUS |

### Slip rules, in order (`rule_fired` ids)

- `slip:5` upgrade first: if the previous response was a SLIP and this item is its sibling, picking an option with the
  **same misconception code** again → MISCONCEPTION.
- `slip:3` right formula, wrong number (option mapped `"SLIP"`, reason correct or absent) → COMPUTATIONAL_SLIP.
- `slip:1` wrong answer + correct reason → SLIP.
- `slip:2` P(L) ≥ 0.80 and option `"UNMAPPED"` → SLIP.
- `slip:4` option code ≠ reason code (both misconception codes) → AMBIGUOUS.
- Rule 5: every SLIP / COMPUTATIONAL_SLIP schedules one sibling item (`GET /items/next` serves it next).

### Misconception status

SUSPECTED after 1 mapped response (MISCONCEPTION or FALSE_POSITIVE). CONFIRMED after evidence on ≥ 2 distinct items,
or 1 item + classifier match ≥ 0.75.

### Clarification

Clarify when classifier top1 < 0.60, or top1 − top2 < 0.15, or < 6 content words (filler/stop words don't count),
or contradiction. Max 2 probes per item, then UNDIAGNOSED.
AMBIGUOUS responses do not touch mastery until resolved; UNDIAGNOSED responses never do.

### BKT per concept

P(L0) = 0.25, T = 0.15, G = 0.10, S = 0.10. Only SCIENTIFIC and FRAGILE count as correct observations.
Pinned test: correct → 0.787, correct → 0.975, wrong → 0.842.
**Mastered** only if P(L) ≥ 0.95 AND ≥ 3 attempts on ≥ 2 distinct items AND last attempt correct AND no CONFIRMED
misconception active for that concept.

### Invariants

- Exactly one function writes mastery: `apply_response(response_id)` in `api/store.py`.
  No endpoint or UI may change mastery from typed text.
- Every outcome stores `rule_fired`, shown by `GET /diagnosis/{id}/why`.
- Items are served to the learner without `correct`, `distractor_map` or reason `maps_to`.

## Layout

```
api/engine/      grading.py (grade, slip_rules, is_sibling) · bkt.py · diagnosis.py (status, clarification, content words)
api/content.py   Pydantic schema + loader for data/*.json (fails fast on bad references)
api/store.py     tables: learners, responses, diagnoses, mastery, assessments; apply_response; queries
api/main.py      endpoints
api/tests/       pytest (engine, data, API via TestClient on a temp DB)
data/            concepts.json, misconceptions.json, items.json, cards.json
```

Endpoints: `GET /health`, `GET /concepts`, `GET /items/next?learner_id=`, `POST /responses`, `POST /clarify`,
`GET /mastery/{learner_id}`, `GET /explain/{card_id}`, `GET /diagnosis/{response_id}/why`.

Run: `.venv/Scripts/python -m pytest` · `.venv/Scripts/uvicorn api.main:app --reload` (port 8000).

## Phases

After EACH phase: run the tests, print "DONE: Phase N" with files created, tests run and results, anything skipped and
why — then STOP and wait for "continue". One git commit per phase.

1. **Engine** (2 h) — brief, `/api` tables + pure engine + endpoints, TODO_VERIFY placeholder data, rule tests and
   the pinned BKT sequence.
2. **Content draft** (1.5 h) — real items, cards, exemplars and contrast probes for C1–C9 per the schemas and solo
   scope. Each wrong option targets one named code; ≥ 2 items have two wrong options mapping to two different codes.
   Exact NCERT formulas and sign conventions; numeric items show `calc`; uncertainty goes in `verify_flags`.
   `scripts/validate_content.py` rejects unknown codes, missing fields, or an item without exactly one CORRECT option.
   Print a compact table of every item (ID, stem, correct answer, codes).
3. **Learner app** (2 h) — `/web` screens wired to the API: Path (9 nodes in 4 zones; glow = P(L); coral pulse =
   confirmed code), Learn (card + "Source: card ID (verified)" + `<SimSlot/>`), Question (answer → reason or "explain
   in my own words" → confidence on one screen), Feedback (category, follow-up, "Why this diagnosis?" drawer), Clarify
   (contrast probe), Mastery (bars + P(L) over time). Persona switcher "Asha" / "Ben". Permanent footer:
   "WaveLoop supports your teacher. It does not replace them." Dark lab theme tokens on `:root` — bg #0B1220,
   panel #131C2E, text #E6EDF7, muted #8A97AD, amber #F2A541, teal #2EC4B6, coral #FF6B6B, green #7BD389;
   Space Grotesk headings, Inter body, JetBrains Mono numbers. Keyboard reachable. Polished, not template-like.
4–6. To be added when received.
