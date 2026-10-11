import { GraduationCap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PracticePanel } from "../components/learn/PracticePanel";
import { LessonPanel } from "../components/learn/LessonPanel";
import { Button, ErrorNote, Loading } from "../components/ui";
import { api, type ConceptMastery, type Lesson, type TutorAnswer } from "../lib/api";
import { STATUS } from "../lib/groups";
import { useLearner } from "../lib/learner";

export default function Learn() {
  const { conceptId = "C1" } = useParams();
  const { learner } = useLearner();
  const learnerId = learner!.learner_id;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [mastery, setMastery] = useState<ConceptMastery | null>(null);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(() => {
    api.mastery(learnerId).then((m) => setMastery(m.concepts.find((c) => c.concept === conceptId) ?? null)).catch(() => {});
  }, [learnerId, conceptId]);

  useEffect(() => {
    setLesson(null);
    setError(null);
    api.lesson(conceptId, learnerId).then(setLesson).catch(setError);
    refresh();
  }, [conceptId, learnerId, refresh]);

  if (error) return <div className="pt-10"><ErrorNote error={error} /></div>;
  if (!lesson) return <Loading what="the lesson" />;

  const topic = lesson.concept.topic_id === "SHM" ? "Simple Harmonic Motion" : "Optics";
  const st = mastery ? STATUS[mastery.status] : null;

  return (
    <div className="pb-10 pt-7">
      <p className="text-[14px] text-muted">
        <Link to="/topics" className="hover:text-ink">{topic}</Link> · <span className="num">{lesson.concept.concept_id}</span>
      </p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]">{lesson.concept.name}</h1>
        {mastery && st && (
          <span title={mastery.status_reason} className="rounded-full bg-blue-soft px-3 py-0.5 text-[13.5px] text-blue-ink">
            {mastery.enough_evidence ? st.label : "Not enough evidence yet"} · {mastery.attempts} {mastery.attempts === 1 ? "answer" : "answers"}
          </span>
        )}
      </div>
      <p className="mt-2 max-w-3xl text-[15.5px] text-muted">{lesson.concept.learning_objective}</p>

      <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <LessonPanel lesson={lesson} />
          <AskBox learnerId={learnerId} conceptId={conceptId} />
        </div>
        <PracticePanel learnerId={learnerId} conceptId={conceptId} onAnswered={refresh} />
      </div>
    </div>
  );
}

function AskBox({ learnerId, conceptId }: { learnerId: string; conceptId: string }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<TutorAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      setAnswer(await api.ask({ learner_id: learnerId, concept: conceptId, question: q.trim() }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Ask a question" className="rounded-xl border border-line bg-surface px-5 py-4">
      <form onSubmit={ask}>
        <label htmlFor="ask" className="text-[14px] text-muted">Ask a question about this concept</label>
        <div className="mt-2 flex gap-2">
          <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Why is the acceleration zero at the mean?"
            className="min-w-0 flex-1 rounded-lg border border-line-strong px-3 py-2 text-[15px] focus:border-blue focus:outline-none" />
          <Button type="submit" variant="secondary" disabled={busy || q.trim().length < 3}>{busy ? "Asking…" : "Ask"}</Button>
        </div>
      </form>
      {error ? <div className="mt-3"><ErrorNote error={error} /></div> : null}
      {answer && (
        <div className="mt-3 rounded-lg bg-surface-2 px-4 py-3">
          <p className="read text-[16px] text-ink">{answer.answer}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
            {answer.grounded_in.length ? <span>From: {answer.grounded_in.join(", ")}</span> : null}
            <span>{answer.engine === "llm" ? "Written by Claude from the course material" : "Matched from the course material"}</span>
            {answer.refer_teacher && <span className="inline-flex items-center gap-1 text-ink-2"><GraduationCap className="size-3.5" aria-hidden="true" /> Worth asking your teacher</span>}
          </p>
        </div>
      )}
    </section>
  );
}
