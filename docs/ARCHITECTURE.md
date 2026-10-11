# LearnLoop AI — Architecture

```
web/  React 18 + Vite + TypeScript + Tailwind ─── /api proxy ───►  api/  FastAPI + SQLModel (SQLite)
  screens/      Landing, Home, Topics, Learn,                          main.py         endpoints, input validation
                Assessment, Report, Doubts, Teacher                    orchestrator.py 3-agent diagnosis pipeline
  components/   learn/ (lesson, practice, feedback,                    engine/         pure rules, no I/O:
                why drawer), DialoguePanel, ContentReview                grading.py  three-tier MCQ + slip rules
  visuals/      SHM oscillator, lens bench, refraction,                  short.py    free-text grader (negation-aware)
                overlays/ ("your idea vs physics")                       bkt.py      BKT + mastery status rules
  voice/        VoiceTutor (ElevenLabs React SDK)                        diagnosis.py misconception status, clarify rules
  lib/api.ts    typed API contract                                       overlay.py  visual-correction numbers
                                                                         physics.py  Snell, lens, SHM formulas
                                                                       ai/llm.py       Claude adapter (optional)
data/  concepts, misconceptions, items, cards (JSON)                   ai/voice.py     ElevenLabs signed URL (optional)
       content/ per-concept drafts → scripts/load_content.py           tutor.py        feedback, follow-ups, adaptive mode
                                                                       dialogue.py     Socratic peer ("Rohan")
                                                                       reports.py      assessments, reports, recommendations
                                                                       teacher.py      class misconception map
                                                                       store.py        tables; apply_response()
```

## One answer, end to end

1. The learner answers (multiple choice with reason and confidence, or a typed or spoken short answer).
2. **Evaluator**: rules decide right/wrong and whether there is a reason. In live mode Claude (`claude-opus-5-5`,
   structured JSON, validated) evaluates free text independently; if Claude and the rules disagree with confidence
   ≥ 0.75, the learner gets a clarifying question. Neither side silently wins.
3. **Diagnoser**: rules match the misconception (option/reason codes, or phrases with negation handling). Only if the
   rules find nothing does Claude propose a code, limited to the question's own list and quoting the learner's words;
   the proposal must still pass the clarification thresholds.
4. **Visual corrector**: for R7, R3, S4 and R5 it computes, with `engine/physics.py`, both the true result and what the
   learner's idea predicts, from the question's own setup. The browser draws the idea dashed over the physics.
5. The diagnosis (category, group A–F, evidence, rule fired, trace) is stored; `apply_response()`, the only function
   that writes mastery, updates BKT, except for unclear, partial, off-topic and undiagnosed answers, which never count.
6. The feedback picks a follow-up: a different question aimed at that misconception, a sibling after a slip, an
   application question after a correct answer, or a clarifying question.

## Rules that never bend

- Rules make the final call; AI output is evidence, validated before use (allowed labels, quotes that really appear
  in the answer, no numbers absent from the course material).
- Typing "I understand" or anything off-topic never changes mastery; Socratic dialogues never change mastery.
- Assessment items are never shown during practice; tests show no answers or feedback; pre and post are scored by
  the same rules.
- Reports count only learners with both tests, state n first, use percentage points, list missing data and limits;
  demo learners are excluded unless explicitly included.
- Keys stay on the server; the browser only gets an ElevenLabs signed URL.

## Mastery

Per concept, BKT with P(L0) = 0.25, T = 0.15, G = 0.10, S = 0.10. Status (in `engine/bkt.py`, one editable place):
Not assessed → Emerging → Developing → Demonstrated understanding. *Demonstrated* needs P(L) ≥ 0.95, at least 3
answers on 2 different questions, the last one right, no confirmed misconception, and a correct application question.
Fewer than 2 answers shows "Not enough evidence yet".

## Data

Tables: `learners`, `responses` (what was submitted), `diagnoses` (what was decided, trace, overlay), `mastery`,
`assessment_sessions`, `assessments`, `dialogues`, `dialogue_turns`. Content lives in `data/*.json`, generated from
`data/content/<concept>_*.json` by `scripts/load_content.py`, which validates every rule in
`scripts/validate_content.py`.
