# Five-minute demo

Before: `bash scripts/start.sh` (or `./scripts/start.ps1`), open http://localhost:5173. For a clean run, clear the demo
learners from the learner menu (**Clear this demo learner's answers**). The teacher step needs
`LEARNLOOP_REVIEWER_TOKEN` from `api/.env`. The header shows **Claude on** / **Voice on** only when each service really
works (voice is checked against ElevenLabs, not just the key).

## 1. Choose a topic (20 s)

**Try a demo learner** (Asha) → Home: **Learn Physics Your Way** with exactly two topics. **Explore SHM** opens the SHM
workspace: **A Learn Visually** (start here), **B Solve My Doubt**, **C Test My Understanding**, **D Summary & My Progress**.

## 2. See it first (40 s)

**Learn Visually** → **Velocity and acceleration in SHM**. It opens on **1 See it**: the spring-block simulation with
play/pause, the time slider, amplitude, live x, v, a, energy bars and x–t, v–t, a–t graphs. Drag the time slider to
the mean (speed largest, acceleration zero) and to an extreme (speed zero, acceleration largest).
Open **Ask the tutor** and ask "why does the acceleration arrow point back to the middle here?": the tutor answers about
the picture on screen. Tabs **2 Understand it** and **3 Solved example** hold the explanation and a worked example.

## 3. Two students, same question, different diagnoses (60 s)

**4 Check yourself**. Pick option A ("speed is largest at the extreme") with the reason "farthest point… going the
fastest", **Sure** → badge **Let's fix this idea**, evidence quoting the choice, the **"your idea vs physics"** overlay,
and a guiding question instead of the answer. **Why this diagnosis?** shows Evaluator → Diagnoser → Visual corrector.
Switch to Ben (learner menu), same question: B ("speed zero and acceleration also zero") with "no velocity means no
acceleration" → a **different** misconception and a **different** follow-up.

## 4. Where did the working go wrong? (45 s)

Under the feedback, **Where did your working go off track?** shows the worked steps (or press **Just show me where I went
wrong**). Tap **step 3** → "your answer
actually went off track **earlier, at step 1**", and the verdict **an idea to fix, not a calculation slip** →
**Watch it in the simulation** returns to **See it**; **Back to your question** brings the steps back. (A slip instead
shows a habit tip and **Try a similar question**.)

Optional (20 s): open `/topic/SHM/learn/C5?s=practice&q=C5-Q2` and type "The total energy is 0.25 J" → the **Mistake
tracer** worked out 12 wrong ways to solve it; 0.25 J matches only "used x instead of A" → diagnosed as that idea.
**See all 12** lists every wrong answer and where it comes from.

## 5. Solve My Doubt (30 s)

**B Solve My Doubt**: pick the idea, ask in your own words, or use **Explain it more simply** / **Show me a worked
example** / **Show me visually**. **Why was my last answer wrong?** pulls the real diagnosis of the last wrong answer.
Voice (English, Hindi, Marathi) sits beside it, or says honestly that it is unavailable while text keeps working.

## 6. Convince Rohan (30 s)

On a misconception in Check yourself, **Talk it through with Rohan** → **Start the conversation**. Agree once (he pushes
back), then explain correctly → **"You convinced Rohan."**

## 7. Measured learning, honestly (40 s)

**C Test My Understanding**: the SHM pre-test (10 multiple-choice questions; Optics has its own 4), numbered bubbles for
answered/skipped, no answers shown. After practice, the post-test uses the same questions. **Your results**: my report
and the class report with n first, change in percentage points, missing data and limitations ("same questions",
"no control group", "preliminary below 10").

## 8. Summary and teacher view (25 s)

**D Summary & My Progress**: evidence-based stars per idea, what to revise next, repeated mistakes and habits, formula
sheet, common mistakes with the fix. Footer → **For teachers** → token → class misconception map and step self-check.

Optional: **Explore Optics** → Lenses: toggle **Convex | Concave** and drag the object; the image and its description
update live.
