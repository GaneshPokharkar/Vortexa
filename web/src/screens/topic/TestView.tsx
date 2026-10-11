import { PenLine } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "../../components/ui";
import Assessment from "../Assessment";
import Report from "../Report";
import { useTopic } from "./TopicLayout";

/** Test My Understanding: pre-test → diagnostic practice → post-test (same items) → report. */
export default function TestView() {
  const { topic, concepts } = useTopic();
  const [running, setRunning] = useState(false);
  const base = `/topic/${topic.topic_id}`;
  return (
    <div>
      <Assessment topic={topic.topic_id} title={`${topic.title} tests`} practiceHref={`${base}/learn`} reportHref="#results" onRunning={setRunning} />
      {!running && (
        <>
          <Panel className="mt-6 flex flex-wrap items-center gap-4 px-6 py-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-soft text-blue-ink" aria-hidden="true"><PenLine className="size-6" /></span>
            <p className="min-w-0 flex-1 basis-64 text-[15.5px] text-ink-2">
              <b className="text-ink">Between the two tests, practise.</b> Every wrong practice answer is diagnosed: a wrong idea or a slip, the step
              where it went off track, and a different follow-up question to check it is fixed.
            </p>
            <Link to={`${base}/learn`} className="text-[15px] font-bold text-blue-ink underline-offset-2 hover:underline">Practise in Learn Visually</Link>
          </Panel>
          <section id="results" className="mt-8 scroll-mt-20">
            <h2 className="mb-3 text-[22px] font-extrabold">Your results in {topic.title}</h2>
            <Report topic={topic.topic_id} concepts={concepts.map((c) => c.concept_id)} base={base} embedded />
          </section>
        </>
      )}
    </div>
  );
}
