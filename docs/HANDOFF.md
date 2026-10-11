# Handoff: LearnLoop AI frontend (teammate)

We are turning WaveLoop into **LearnLoop AI — Adaptive AI Tutor & Misconception Detector** (problem E-01) in under
6 hours. Stack stays: FastAPI backend in `/api`, React 18 + Vite + Tailwind v4 in `/web`.

## Who owns what

| Area | Owner | Branch |
|---|---|---|
| `/api`, `/data`, `/scripts`, LLM (Claude) + ElevenLabs server side | Ganesh | `ganesh/learnloop-core` |
| `web/src/visuals/` (SHM oscillator, lens bench, refraction) | Ganesh | same |
| `web/src/voice/` (`<VoiceTutor/>` component, ElevenLabs React SDK) | Ganesh | same |
| **Everything else in `/web`: theme, layout, all screens, routing, Lucide icons** | **You** | `<yourname>/web-learnloop` |
| `web/src/lib/api.ts` (the contract) | shared — announce edits | — |

Start: `git switch main && git pull --rebase && git switch -c <yourname>/web-learnloop`. Merge order at the end:
Ganesh's branch first, then yours (rebase on main, fix conflicts in `api.ts` only if needed).

## The contract

`web/src/lib/api.ts` is the full typed API. Endpoints marked ✅ work today; 🛠 are being built and land within
~3 hours. Until then, build screens against the types with a small local mock (e.g. `web/src/lib/mock.ts`, delete it
before merging). Never compute grades, diagnoses or mastery in the browser — the server decides; screens display.

Run the backend: `.venv/Scripts/uvicorn api.main:app --reload` (port 8000). Frontend: `cd web && npm run dev` (5173,
proxies `/api`).

## Theme (master prompt: white / light-blue, navy type, restrained blue)

Replace the dark tokens in `web/src/index.css` with these on `:root` (the visuals already read them by these names):

```
--ll-bg #F5F9FF   --ll-surface #FFFFFF   --ll-surface-2 #EEF4FC   --ll-line #D9E3F0
--ll-ink #0E2A47  --ll-muted #5A6B82     --ll-blue #2563EB        --ll-blue-soft #DBEAFE
group colours: A correct #15803D · B misconception #B91C1C · C slip #B45309 · D partly #0369A1 · E clarify #0369A1 · F off-topic #64748B
```

Subtle shadows, soft borders, generous spacing, visible focus rings, no glassmorphism, no giant gradients. Icons:
`npm install lucide-react` (approved). Keep Inter for body; pick one heading face (Space Grotesk is fine).

## Screens (master prompt §13) → API

| # | Screen | Route | Calls |
|---|---|---|---|
| 1 | Landing: branding, what it does, **Start learning**, SHM + Optics previews, "supports teachers" statement | `/` | `topics` |
| 2 | Dashboard: welcome, continue, topic cards, recent activity, concepts to revise, progress, next action | `/dashboard` | `mastery`, `recommendations`, `learnerReport` |
| 3 | Topic & concept selection: SHM primary, Optics extension; cards with objective + status | `/topics` | `topics`, `concepts`, `mastery` |
| 4 | Learning workspace: explanation with mode switch (Beginner / Step-by-step / Worked example / Analogy / Visual / Practice), equations with variable definitions, `<Visual/>`, `<VoiceTutor/>`, text "ask a question", answer area (MCQ three-tier or short text), follow-up panel, next activity | `/learn/:conceptId` | `lesson`, `nextItem`, `getItem`, `respond`, `clarify`, `ask` |
| 5 | Diagnostic feedback (panel inside 4): your answer, right/wrong, group label A–F, likely error, **evidence list**, confidence ("heuristic, not calibrated"), next activity, "ask for clarification", "Why this diagnosis?" drawer | — | `Feedback`, `why` |
| 6 | Pre-test / post-test: one question at a time, progress bar, no answer reveal, completion screen with score | `/assessment/:kind` | `startAssessment`, `answerAssessment`, `completeAssessment` |
| 7 | Learning report: pre/post, change in **percentage points**, n, concept progress, repeated misconceptions, recent attempts, revision path, limitations; class view toggle | `/report` | `learnerReport`, `report` |
| 8 | Common doubts: search, filter by concept, short answers, "ask the voice tutor" link, banner "Curated examples, not measured trends" | `/doubts` | `doubts` |
| 9 | Teacher review: token prompt, then content review status, answer keys, misconceptions | `/review` | `review` |

Always visible: mode badges from `modes()` ("Demo diagnosis engine" when `llm.live` is false; "Voice not configured"
when `voice.live` is false), and the footer "LearnLoop supports your teacher. It does not replace them."

Learners: **Start learning** calls `createLearner()` (anonymous id, store in localStorage). A "Demo learners" switcher
(`demoLearners()`) shows Asha/Ben clearly labelled *Demo*, with a "Clear demo data" button (`resetDemo`). Never ask
for names or schools.

Embedding my components:

```tsx
import { VISUALS } from "../visuals";          // keys: "shm-oscillator" | "lens-bench" | "refraction"
const V = VISUALS[lesson.card.visual]; {V && <V />}
import VoiceTutor from "../voice/VoiceTutor";  // lands later today
<VoiceTutor learnerId={learnerId} conceptId={conceptId} onFeedback={(fb) => showFeedback(fb)} />
```

## Rules that judges will test — don't break them in the UI

- Mastery shows `status` + `status_reason`; if `enough_evidence` is false show **"Not enough evidence yet"**, never a
  bare percentage. Typed text like "I understand" must never change anything.
- Show `evidence` and `confidence` as "how sure the tutor is (heuristic)"; never call it a probability.
- Assessment screens never show correct answers or per-question feedback.
- Report: n first; percentage points vs relative change spelled out; always print `limitations`.
- No fake statistics or sample students anywhere; demo learners are labelled Demo.
- Every button does something; loading, empty and error states on every screen; keyboard reachable.

## Paste this into your Claude Code session

> Read docs/PROJECT_BRIEF.md and docs/HANDOFF.md. You own /web except web/src/visuals, web/src/voice and the
> contract in web/src/lib/api.ts (announce changes). Build the 9 LearnLoop AI screens in HANDOFF.md against
> web/src/lib/api.ts with the light theme tokens given, react-router-dom routes, lucide-react icons. Use a temporary
> mock for 🛠 endpoints. Keep pure display logic in web/src/lib with Vitest tests. Work on branch
> <yourname>/web-learnloop; before each push run `npm test` and `npm run build`. Do not touch /api or /data.
