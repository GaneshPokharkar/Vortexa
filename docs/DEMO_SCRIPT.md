# Five-minute demo

Before: `bash scripts/start.sh` (or `./scripts/start.ps1`), open http://localhost:5173. For a clean run, clear the demo
learners from the learner menu (**Clear this demo learner's answers**). The teacher step needs
`LEARNLOOP_REVIEWER_TOKEN` from `api/.env`. With keys set, the header shows **Claude on** (and **Voice on**).

## 1. The problem in one picture (30 s)

Landing page: the films, then "One question, three students". Same question, three answers, three different diagnoses
and next questions. *"A wrong answer is a symptom. LearnLoop finds the cause."*

## 2. Two students, same question, different diagnoses (75 s)

**Try a demo learner** (Asha) → Learn → **C2 Velocity and acceleration**.
- Pick option A ("speed is largest at the extreme") with the reason "farthest point… going the fastest", **Sure** →
  badge **Let's fix this idea**, evidence quoting the choice, the **"your idea vs physics"** speed overlay (drag the
  block: 0.80 vs 0.60 m/s), and a guiding question instead of the answer. The speaker button reads the headline.
- Open **Why this diagnosis?**: Evaluator → Diagnoser → Visual corrector, the rule that fired, the evidence.
- Switch to Ben (learner menu), same question. Pick B ("speed zero and acceleration also zero") with the reason
  "no velocity means no acceleration" → a **different** misconception (zero velocity means zero acceleration) and a
  **different** follow-up.

## 3. Where did the working go wrong? (45 s)

Learn → **C1**, Ananya's spring question. Pick A ("Amplitude 12 cm") with the reason "from P all the way to Q".
The **Where did your working go off track?** box shows the worked steps. Tap **step 3** → "Your answer actually went
off track **earlier, at step 1**: taking the full 12 cm as the amplitude", and the idea behind it.
*The student looks for the mistake first; the rules then show where the answer really went wrong.*

## 4. Slip vs misconception (30 s)

On any multiple-choice question, pick a **wrong option** but the **correct reason** → badge **Tiny slip**: "your
reasoning was right; the answer slipped", and a similar question comes next. The same careless habit (a dropped ½,
a missed √) on two different questions shows up as a **habit to watch** in the feedback and on Home.

## 5. Convince Rohan (45 s)

On a misconception, **Talk it through with Rohan** → **Start the conversation**. Agree with him once (he pushes back with a probe), then explain
correctly → **"You convinced Rohan."**

## 6. Ask the tutor (20 s)

Bottom right, **Ask the tutor** opens a chat window. Tap a suggested doubt, or type "why the acc is 0": the answer is
written from the course material only, and says when a question is one for the teacher.

## 7. Teacher view (30 s)

Footer → **For teachers** → token → **Class misconception map**: active vs resolved bars per idea, each student's
flagged idea in their own words, Rohan's conversation marked *resolved*, and the step check: which step students
picked vs where their answers really went wrong. **Content review** tab: answer keys and review flags.

## 8. Measured learning, honestly (25 s)

**Tests** → pre-test (14 questions; the numbered bubbles show what's answered or skipped, no answers shown) →
practise → post-test → **Report**: n first, change in percentage points, missing data, limitations ("same questions",
"no control group", "preliminary below 10").

Optional: **Start voice** on a learning page runs the same diagnosis by speech (English, Hindi or Marathi). Each voice
call is capped at 3 minutes.
