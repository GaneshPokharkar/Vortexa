import { Eye, HelpCircle, Mic } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChatBody } from "../../components/learn/AskChat";
import { Button, ErrorNote, GroupBadge, Panel } from "../../components/ui";
import { api, type Attempt, type Lesson, type Why } from "../../lib/api";
import { HEADLINE } from "../../lib/groups";
import { useTopic } from "./TopicLayout";

const VoiceTutor = lazy(() => import("../../voice/VoiceTutor"));

/** Solve My Doubt: text chat (grounded in the course), voice where configured, and "why was my answer wrong?". */
export default function DoubtView() {
  const { learnerId, topic, concepts } = useTopic();
  const [conceptId, setConceptId] = useState(concepts[0]?.concept_id ?? "");
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [last, setLast] = useState<{ attempt: Attempt; why: Why } | null | "none">(null);
  const [error, setError] = useState<unknown>(null);
  const concept = concepts.find((c) => c.concept_id === conceptId);

  useEffect(() => { setLesson(null); api.lesson(conceptId, learnerId).then(setLesson).catch(() => {}); }, [conceptId, learnerId]);

  const explainLast = async () => {
    setError(null);
    try {
      const rep = await api.learnerReport(learnerId);
      const ids = new Set(concepts.map((c) => c.concept_id));
      const wrong = [...rep.recent].reverse().find((a) => ids.has(a.item_id.split("-")[0]) && a.group !== "A");
      setLast(wrong ? { attempt: wrong, why: await api.why(wrong.response_id) } : "none");
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <h2 className="text-[20px] font-extrabold">Ask your doubt about {topic.title}</h2>
        <p className="mt-1 text-[15px] text-muted">Pick the idea, then ask in your own words. Answers come only from your course material.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Which idea is your doubt about?">
          {concepts.map((c) => (
            <button key={c.concept_id} type="button" role="radio" aria-checked={c.concept_id === conceptId} onClick={() => setConceptId(c.concept_id)}
              className={`rounded-full border-2 px-3 py-1.5 text-[13.5px] font-bold ${
                c.concept_id === conceptId ? "border-blue bg-blue-soft text-blue-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
              {c.name}
            </button>
          ))}
        </div>
        <Panel className="mt-4 flex flex-col overflow-hidden">
          {concept && (
            <ChatBody key={conceptId} learnerId={learnerId} conceptId={conceptId} conceptName={concept.name} tall
              suggestions={(lesson?.doubts ?? []).slice(0, 3).map((d) => d.q)}
              quick={["Explain it more simply", "Show me a worked example", "Why does this happen?"]} />
          )}
        </Panel>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`../learn/${conceptId}?s=see`} relative="path"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 py-2.5 text-[15px] font-bold text-ink hover:border-blue hover:text-blue-ink">
            <Eye className="size-4" aria-hidden="true" /> Show me visually
          </Link>
          <Button variant="secondary" onClick={explainLast}><HelpCircle className="size-4" aria-hidden="true" /> Why was my last answer wrong?</Button>
        </div>
        {error ? <div className="mt-3"><ErrorNote error={error} /></div> : null}
        {last === "none" && (
          <p className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-[15px] text-ink-2">
            No wrong answers in {topic.title} yet. Try <Link to="../test" relative="path" className="font-bold text-blue-ink underline">Test My Understanding</Link> or a practice question in Learn Visually.
          </p>
        )}
        {last && last !== "none" && (
          <Panel className="mt-3 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <GroupBadge group={last.why.group} />
              <span className="text-[13px] text-muted">Your answer to {last.attempt.item_id}</span>
            </div>
            <p className="read mt-2 text-[15.5px] italic text-ink-2">“{last.attempt.answer}”</p>
            <p className="mt-2 text-[16px] font-bold text-ink">{HEADLINE[last.why.category]}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[14.5px] text-ink-2">
              {last.why.evidence.map((e) => <li key={e}>{e}</li>)}
            </ul>
            <Link to={`../learn/${last.attempt.item_id.split("-")[0]}?s=practice`} relative="path"
              className="mt-3 inline-flex text-[14.5px] font-bold text-blue-ink underline-offset-2 hover:underline">
              Practise this idea again, with the step-by-step check
            </Link>
          </Panel>
        )}
      </div>

      <aside className="min-w-0">
        <h3 className="flex items-center gap-2 text-[16px] font-extrabold"><Mic className="size-4" aria-hidden="true" /> Ask out loud</h3>
        <p className="mt-1 text-[14px] text-muted">English, Hindi or Marathi. It uses the same diagnosis as typed answers.</p>
        <div className="mt-3">
          {concept && (
            <Suspense fallback={null}>
              <VoiceTutor key={conceptId} learnerId={learnerId} conceptId={conceptId} conceptName={concept.name} />
            </Suspense>
          )}
        </div>
      </aside>
    </div>
  );
}
