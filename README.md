# LearnLoop AI — Adaptive AI Tutor & Misconception Detector

VORTEXA 3.0 · problem **E-01**. A physics tutor for Maharashtra State Board HSC students (Class 11–12) that works out
**why** a student is wrong, teaches to that reason, and checks whether understanding actually improved.

- **Simple Harmonic Motion** is the full module (concepts C1–C5); **Optics** (C6 refraction & TIR, C7 lenses) is the
  extension built on the same engine.
- Every answer goes through a **3-agent pipeline**: Evaluator → Diagnoser → Visual corrector. Fixed rules make the
  final call; Claude adds evidence for free-text answers; physics code draws a "your idea vs real physics" overlay.
- A **confused classmate (Rohan)** argues the student's wrong idea back at them; a **teacher map** shows which ideas each
  student holds, in their own words.
- After a wrong answer the student sees the **worked steps**, taps where their working went off track, and learns
  where the answer really went wrong; repeated careless **habits** (a dropped ½, a missed √) are flagged.
- An **Ask the tutor** chat answers doubts from the course material only.
- **Pre/post tests** use the same questions; the report shows n, change in percentage points and its limits.
- **Voice** (ElevenLabs Agents) and **Claude** are optional: without keys the app runs in a clearly labelled demo mode.

LearnLoop supports teachers. It does not replace them.

## Run it

Requirements: Python 3.11+ (tested on 3.13), Node 20+ (tested on 24), Git. Windows, macOS or Linux.

```bash
git clone https://github.com/GaneshPokharkar/Vortexa.git && cd Vortexa
python -m venv .venv
.venv/Scripts/python -m pip install -r api/requirements.txt      # macOS/Linux: .venv/bin/python
cd web && npm install && cd ..
```

Start both servers with one command:

```bash
bash scripts/start.sh          # Windows PowerShell: ./scripts/start.ps1
```

Open http://localhost:5173. The API runs on http://127.0.0.1:8000 (the web app proxies it under `/api`).
The database (`data/learnloop.db`, SQLite) is created on first start; delete it to start fresh.

### Demo mode and live mode

| | Without keys (demo mode) | With keys (live mode) |
|---|---|---|
| Diagnosis | Rules only; header shows **Demo engine** | Claude cross-checks and fills gaps; header shows **Claude on** |
| Rohan | Scripted lines from curated content | Claude writes his lines (grounded, rules choose his move) |
| Voice | **Voice off**, with the exact missing variable named | ElevenLabs agent; see `docs/VOICE_AGENT.md` |
| Everything else | Works fully | Same |

Copy `api/.env.example` to `api/.env` and fill in what you have:

| Variable | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Enables Claude (`claude-opus-5-5` by default; `LEARNLOOP_MODEL=claude-haiku-4-5` is much cheaper). `LEARNLOOP_LLM=off` forces demo mode. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` | Enables the voice tutor. Create the agent with `docs/VOICE_AGENT.md`. |
| `LEARNLOOP_REVIEWER_TOKEN` | Opens the teacher pages (`/teacher`): class misconception map and content review. |

Keys stay on the server: the browser only ever receives a short-lived ElevenLabs signed URL.

## Tests

```bash
.venv/Scripts/python -m pytest          # 94 backend tests: rules, scenarios A–K, orchestrator, overlays, dialogue, steps, habits, Q&A, teacher
cd web && npm test                      # 23 frontend tests: physics helpers, overlay geometry, display rules, speech lines
cd web && npm run build                 # type-check + production build
python scripts/validate_content.py      # content rules; add --table to print every question for review
```

Scenario tests map to the brief: A correct → transfer question; B/C two different wrong answers → two different
diagnoses and follow-ups; D calculation slip ≠ misconception; E unclear answer → clarifying question; F changed
understanding is recorded; G pre/post use the same items and score correctly; H report counts only matched learners
and lists missing ones; I records survive a restart; J missing keys or provider failure never crash; K AI output that
invents numbers, codes or quotes is rejected; and typing "I understand" never changes mastery.

## Deploy

`npm run build` writes the static site to `web/dist`. Serve it from any static host and point `/api` at the FastAPI app
(`uvicorn api.main:app --host 0.0.0.0 --port 8000`). SQLite needs a persistent disk; for several servers, move to a
hosted database (the SQLModel tables in `api/store.py` port directly).

## What a physics teacher must verify

All content is a **seeded draft**, written for this prototype and marked for review. No textbook citation is claimed.
Before use with students, a teacher should check every item in `/teacher` → **Content review** (or
`python scripts/validate_content.py --table`): answers and working, the sign convention for lenses against the
Maharashtra State Board textbook, the wording of misconceptions, and the Marathi/Hinglish phrasings.
See `docs/CONTENT_REVIEW.md`.

## Limitations and next steps

- Content is unverified (above). Item difficulty has not been calibrated with real students.
- Keyword rules can miss unusual wording; Claude helps in live mode, and unclear answers become clarifying questions,
  but some answers will end as "couldn't tell".
- Confidence values are heuristics, not calibrated probabilities, and are shown in words.
- Pre/post uses the same questions, so gains include memory and practice effects; there is no control group.
- Anonymous learners live on one device; there are no accounts or class rosters yet.
- Voice depends on an ElevenLabs agent configured as in `docs/VOICE_AGENT.md`; diagnosis keywords are English, so
  Marathi answers rely on the agent's translation.
- Next: teacher-editable content in the app, more concepts (waves are archived in `data/archive/`), class rosters, and
  calibrating the mastery thresholds on real data.

More: `docs/ARCHITECTURE.md` (how it works), `docs/DEMO_SCRIPT.md` (5-minute demo), `docs/PROJECT_BRIEF.md` (rules).
