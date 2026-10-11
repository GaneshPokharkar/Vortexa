import { ArrowRight, BookOpenText, MessageCircleQuestion, ScanSearch, Sigma, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Films } from "../components/Films";
import { Button, ConceptTile, ErrorNote, GroupBadge } from "../components/ui";
import { api, type Concept, type Group, type Learner, type Topic } from "../lib/api";
import { useLearner } from "../lib/learner";

// The brief's own example. These are the engine's actual responses to these answers (see api/tests/test_learnloop.py).
const STUDENTS: { answer: string; group: Group; finding: string; asks: string }[] = [
  {
    answer: "At the extreme position, because that is the farthest point.",
    group: "B",
    finding: "Mixes up displacement and speed.",
    asks: "What happens to the oscillator's kinetic energy when it momentarily stops at an extreme position?",
  },
  {
    answer: "It is constant everywhere.",
    group: "B",
    finding: "Thinks the speed never changes during the swing.",
    asks: "Compare the speed at the mean position with the speed at an extreme position. Are they equal?",
  },
  {
    answer: "At the centre, I think.",
    group: "D",
    finding: "Right answer, but the reasoning is unknown.",
    asks: "Why is the speed maximum there?",
  },
];

const STEPS = [
  { icon: BookOpenText, title: "Learn the idea", text: "Plain explanation, the formal physics, an analogy and an interactive diagram." },
  { icon: MessageCircleQuestion, title: "Answer with a reason", text: "Pick or type an answer and say why, typed or spoken." },
  { icon: ScanSearch, title: "Get a diagnosis", text: "Correct, misconception, slip, partly right or unclear, with the evidence shown." },
  { icon: Sigma, title: "Targeted follow-up", text: "A different next step for each kind of mistake, never the same explanation twice." },
  { icon: TrendingUp, title: "Mastery from evidence", text: "Only answered questions count. Saying “I understand” never does." },
];

const STEP_TONE = ["bg-blue-soft text-blue-ink", "bg-sun-soft text-[#9a5b00]", "bg-coral-soft text-[#b4382a]", "bg-grape-soft text-grape", "bg-mint-soft text-[#0b7a58]"];

export default function Landing() {
  const { learner, startNew, useDemo } = useLearner();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!learner) await startNew();
      navigate("/home");
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    setError(null);
    try {
      const demos = await api.demoLearners();
      useDemo(demos[0] as Learner);
      navigate("/home");
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <div>
      <section className="grid items-start gap-10 pb-16 pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-16">
        <div className="max-w-xl">
          <p className="inline-flex rounded-full bg-blue-soft px-3 py-1 text-[14px] font-bold text-blue-ink">Physics tutor for Maharashtra State Board HSC, Class 11–12</p>
          <h1 className="mt-4 text-[38px] font-extrabold leading-[1.1] sm:text-[46px]">
            See why a student got it wrong, not just that they did.
          </h1>
          <p className="read mt-5 text-[18px] text-ink-2">
            LearnLoop starts with Simple Harmonic Motion. It reads the reasoning behind each answer, teaches to that
            reasoning, and checks whether understanding actually improved.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button onClick={start} disabled={busy} className="px-5 py-3 text-[16px]">
              {learner ? "Continue learning" : "Start learning"} <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            {!learner && (
              <Button variant="secondary" onClick={demo} disabled={busy} className="px-5 py-3 text-[16px]">
                Try a demo learner
              </Button>
            )}
          </div>
          <p className="mt-3 text-[14px] text-muted">No sign-up. You stay anonymous on this device.</p>
          {error ? <div className="mt-4"><ErrorNote error={error} /></div> : null}
        </div>

        <Films />
      </section>

      <section className="border-t border-line py-14" aria-labelledby="how">
        <h2 id="how" className="text-[24px] font-extrabold">How a lesson works</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-5 md:gap-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              {i < STEPS.length - 1 && (
                <span aria-hidden="true" className="absolute left-12 right-0 top-[18px] hidden h-0.5 bg-line-strong md:block" />
              )}
              <span className={`relative grid size-9 place-items-center rounded-xl text-[15px] font-extrabold ${STEP_TONE[i]}`}>
                {i + 1}
              </span>
              <p className="mt-3 flex items-center gap-2 font-bold text-ink">
                <s.icon className="size-4 text-blue" aria-hidden="true" /> {s.title}
              </p>
              <p className="mt-1 text-[15px] text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="grid items-start gap-10 border-t border-line py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
        aria-labelledby="diagnosis"
      >
        <div className="max-w-xl lg:sticky lg:top-24">
          <h2 id="diagnosis" className="text-[24px] font-extrabold">Same question, different reasoning</h2>
          <p className="read mt-3 text-[17px] text-ink-2">
            Three students answer the same question. LearnLoop reads the reason behind each answer, names what is going
            on, and asks each of them a different next question.
          </p>
        </div>
        <ThreeStudents />
      </section>

      <Modules />

      <section className="border-t border-line py-14" aria-labelledby="honest">
        <h2 id="honest" className="text-[24px] font-extrabold">What it will not do</h2>
        <ul className="mt-6 grid gap-x-10 gap-y-4 text-[16px] text-ink-2 md:grid-cols-2">
          <li>Count “I understand” as learning. Mastery moves only on answered questions.</li>
          <li>Let the AI overrule the answer key. Claude can suggest; fixed rules decide.</li>
          <li>Hide how few students a result is based on. Every report shows n and its limits.</li>
          <li>Replace your teacher. Unclear cases are sent back to them.</li>
        </ul>
      </section>
    </div>
  );
}

function ThreeStudents() {
  return (
    <figure className="rounded-2xl border border-line bg-surface p-6 shadow-[0_2px_0_var(--ll-line)] sm:p-7">
      <figcaption className="text-[14px] font-bold uppercase tracking-wide text-muted">One question, three students</figcaption>
      <p className="read mt-2 text-[19px] leading-snug text-ink">
        Where is the speed of an ideal simple harmonic oscillator maximum? Give a reason.
      </p>
      <ol className="mt-6 space-y-5">
        {STUDENTS.map((s, i) => (
          <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
            <span className="mt-0.5 grid size-7 place-items-center rounded-full bg-blue-soft text-[13px] font-extrabold text-blue-ink">
              {String.fromCharCode(65 + i)}
            </span>
            <div>
              <p className="read text-[17px] italic text-ink">“{s.answer}”</p>
              <p className="mt-2 text-[14.5px] text-ink-2">
                <GroupBadge group={s.group} /> <span className="ml-1 align-middle">{s.finding}</span>
              </p>
              <p className="mt-2 border-l-2 border-blue-soft pl-3 text-[14.5px] text-muted">
                Tutor asks next: <span className="text-ink-2">{s.asks}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 border-t border-line pt-4 text-[13px] text-muted">
        These are the tutor's actual responses. Same wrong answer, same diagnosis; different wrong answer, different next step.
      </p>
    </figure>
  );
}

function Modules() {
  const [data, setData] = useState<{ topics: Topic[]; concepts: Concept[] } | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    Promise.all([api.topics(), api.concepts()]).then(([topics, concepts]) => setData({ topics, concepts })).catch(setError);
  }, []);

  return (
    <section className="border-t border-line py-14" aria-labelledby="modules">
      <h2 id="modules" className="text-[24px] font-extrabold">What you can study</h2>
      {error ? <div className="mt-6"><ErrorNote error={error} /></div> : null}
      {data && (
        <div className="mt-6 grid gap-10 md:grid-cols-[1.3fr_1fr]">
          {data.topics.map((t) => (
            <div key={t.topic_id}>
              <div className="flex items-baseline gap-3">
                <h3 className="text-[19px] font-extrabold">{t.title}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${t.primary ? "bg-blue-soft text-blue-ink" : "bg-grape-soft text-grape"}`}>{t.primary ? "Main module" : "Extension"}</span>
              </div>
              <p className="mt-1 text-[15px] text-muted">{t.description}</p>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {data.concepts.filter((c) => c.topic_id === t.topic_id).map((c) => (
                  <li key={c.concept_id} className="flex items-center gap-3 py-2.5">
                    <ConceptTile id={c.concept_id} size="sm" />
                    <span className="text-[15.5px] font-semibold text-ink">{c.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-[14px] text-muted">
        Teachers: all content is a seeded draft marked for academic review. <Link to="/teacher" className="text-blue-ink underline-offset-2 hover:underline">Teacher view</Link>.
      </p>
    </section>
  );
}
