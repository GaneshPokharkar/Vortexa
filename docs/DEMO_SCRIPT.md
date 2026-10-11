# Five-minute demo

Before: `bash scripts/start.sh` (or `./scripts/start.ps1`), open http://localhost:5173. For a clean run, clear the demo
learners from the learner menu (**Clear this demo learner's answers**). Set `LEARNLOOP_REVIEWER_TOKEN` in `api/.env`
for the teacher step.

## 1. The problem in one picture (30 s)

Landing page: "One question, three students". Same question, three answers, three different diagnoses and next
questions. *"A wrong answer is a symptom. LearnLoop finds the cause."*

## 2. Two students, same question, different diagnoses (90 s)

**Try a demo learner** (Asha) → Learn → **C2 Velocity and acceleration**.
- Pick option A ("speed is largest at the extreme") with the reason "farthest point… going the fastest", **Sure** →
  **Likely misconception**, evidence quoting the choice, the **"your idea vs physics"** speed overlay (drag the
  block: 0.80 vs 0.60 m/s), and a guiding question instead of the answer.
- Open **Why this diagnosis?**: Evaluator → Diagnoser → Visual corrector, the rule that fired, the evidence.
- Switch to Ben (learner menu). Answer the short question with "It is constant everywhere." → a **different**
  misconception (speed constant) and a **different** follow-up.
- Answer "At the centre, I think." → **Partly correct**: the tutor asks *why* instead of guessing.

## 3. Slip vs misconception (30 s)

On any multiple-choice question, pick a **wrong option** but the **correct reason** → **Possible slip**: "your
reasoning was right; the answer slipped", and a similar (sibling) question comes next. If the learner then makes the
same wrong choice on the sibling, it is upgraded to a misconception (slip rule 5).

## 4. Convince Rohan (60 s)

On a misconception, **Talk it through with Rohan**. Agree with him once (he pushes back with a probe), then explain
correctly → **"You convinced Rohan."**

## 5. Evidence, not claims (30 s)

Type "I understand" as an answer → **Needs clarification / Off-topic**; the concept status does not move.
Point at the status chip: "Not enough evidence yet · 1 answer".

## 6. Teacher view (30 s)

Footer → **For teachers** → token → **Class misconception map**: active vs resolved bars per idea, each student's
flagged idea with their exact words, Rohan's conversation marked *resolved*. **Content review** tab: answer keys and
review flags.

## 7. Measured learning, honestly (30 s)

**Tests** → pre-test (14 questions, no answers shown) → practise → post-test → **Report**: change in percentage points,
n first, missing data, limitations ("same questions", "no control group", "preliminary below 10").

Optional: with keys set, the header shows **Claude on** and **Voice on**; **Start voice** on a learning page runs the
same diagnosis by speech (English or Marathi).
