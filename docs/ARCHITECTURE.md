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
2. **Evaluator**: rules decide right/wrong and whether there is a reason. In live mode Claude (`LEARNLOOP_MODEL`; this deployment uses `claude-haiku-4-5`,
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
7. **Step check** (questions with worked `steps`): after a wrong answer the learner taps the step where their working
   went off track (`POST /responses/{id}/step`, stored in `step_picks`). `tutor.traced_step()` finds the step the
   answer really traces to: the chosen option's code for multiple choice, or the number matched to a step's slip value
   for short answers. The traced step is revealed only after the learner has picked. Self-report never changes mastery.
8. **Mistake habits**: every slip step carries a habit (HALF, ROOT, SQUARE, SIGN, UNIT, ARITH). A habit seen on two
   different questions is shown to the learner (`GET /habits/{learner_id}` and in the feedback). Read-only; slips stay
   separate from misconceptions.

## Asking the tutor

The chat window (`POST /tutor/ask`) answers only from course material. It ranks sources from every concept, preferring
the current one, after expanding student shorthand (acc, vel, 0, KE…). Claude writes the answer from the top sources and
every number must appear in the cited material; without Claude, the closest course question and its answer are shown,
or the learner is pointed to the teacher.

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
Not assessed → Emerging → Developing → Demonstrated understanding (students see: Not started → Just started →
Getting there → Got it!, as 0–3 stars). *Demonstrated* needs P(L) ≥ 0.95, at least 3
answers on 2 different questions, the last one right, no confirmed misconception, and a correct application question.
Fewer than 2 answers shows "Not enough evidence yet".

## Data

Tables: `learners`, `responses` (what was submitted), `diagnoses` (what was decided, trace, overlay), `mastery`,
`assessment_sessions`, `assessments`, `dialogues`, `dialogue_turns`, `step_picks`. Content lives in `data/*.json`, generated from
`data/content/<concept>_*.json` by `scripts/load_content.py`, which validates every rule in
`scripts/validate_content.py`.
