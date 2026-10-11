import { ArrowRight, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonLink, ErrorNote, GroupBadge, Loading, Panel } from "../components/ui";
import { api, type Concept, type LearnerReport, type Recommendations } from "../lib/api";
import { STATUS } from "../lib/groups";
import { learnerName, useLearner } from "../lib/learner";

const KIND_LABEL: Record<string, string> = {
  misconception: "Wrong idea to fix", prerequisite: "Do this first", revise: "Practise", improving: "Improving", next: "Start here", practice: "Practise",
};

export default function Home() {
  const { learner } = useLearner();
  const [data, setData] = useState<{ rep: LearnerReport; recs: Recommendations; concepts: Map<string, Concept> } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const id = learner!.learner_id;
    Promise.all([api.learnerReport(id), api.recommendations(id), api.concepts()])
      .then(([rep, recs, cs]) => setData({ rep, recs, concepts: new Map(cs.map((c) => [c.concept_id, c])) }))
      .catch(setError);
  }, [learner]);

  if (error) return <div className="pt-10"><ErrorNote error={error} /></div>;
  if (!data) return <Loading what="your dashboard" />;
  const { rep, recs, concepts } = data;
  const next = recs.next_lesson;
  const who = learnerName(learner);
  const answered = rep.concepts.reduce((s, c) => s + c.attempts, 0);

  return (
    <div className="pb-10 pt-8">
      <h1 className="text-[30px] font-semibold">{who === "You" ? "Welcome back" : `Welcome, ${who.replace(" (demo)", "")}`}</h1>
      <p className="mt-1 text-muted">{answered ? `${answered} ${answered === 1 ? "answer" : "answers"} so far. Here's where to go next.` : "Let's begin with the first idea in Simple Harmonic Motion."}</p>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel className="px-6 py-6">
          <p className="text-[14px] text-muted">Continue learning</p>
          {next ? (
            <>
              <p className="mt-1 text-[22px] font-semibold text-ink">{concepts.get(next.concept)?.name}</p>
              <p className="mt-1 text-[15px] text-ink-2">Why this: {next.reason}</p>
              <ButtonLink to={`/learn/${next.concept}`} className="mt-5">Continue <ArrowRight className="size-4" aria-hidden="true" /></ButtonLink>
            </>
          ) : (
            <p className="mt-1 text-[18px] text-ink">Every concept shows demonstrated understanding. Take the post-test to measure the change.</p>
          )}
        </Panel>
        <Panel className="px-6 py-6">
          <p className="text-[14px] text-muted">Tests</p>
          <ul className="mt-2 space-y-1.5 text-[15px] text-ink">
            <li>Pre-test: {rep.pre ? <span className="num">{rep.pre.score_percentage}%</span> : <span className="text-muted">not taken</span>}</li>
            <li>Post-test: {rep.post ? <span className="num">{rep.post.score_percentage}%</span> : <span className="text-muted">not taken</span>}</li>
            {rep.change_pp !== null && <li>Change: <span className="num font-medium">{rep.change_pp > 0 ? "+" : ""}{rep.change_pp} percentage points</span></li>}
          </ul>
          {(!rep.pre || !rep.post) && (
            <ButtonLink to="/assessment" variant="secondary" className="mt-4">
              <ClipboardCheck className="size-4" aria-hidden="true" /> {rep.pre ? "Take the post-test" : "Take the pre-test"}
            </ButtonLink>
          )}
        </Panel>
      </div>

      <Panel className="mt-6">
        <h2 className="border-b border-line px-6 py-3.5 text-[16px] font-semibold">Progress</h2>
        <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
          {rep.concepts.map((m) => (
            <li key={m.concept} className="flex items-center justify-between gap-4 px-6 py-3 sm:border-b sm:border-line">
              <Link to={`/learn/${m.concept}`} className="min-w-0 truncate text-[15px] text-ink hover:text-blue-ink">
                <span className="num mr-1.5 text-muted">{m.concept}</span>{concepts.get(m.concept)?.name}
              </Link>
              <span className="flex shrink-0 items-center gap-2 text-[13px] text-muted" title={m.status_reason}>
                <span className="flex gap-0.5" aria-hidden="true">
                  {[1, 2, 3].map((s) => <span key={s} className="h-1.5 w-4 rounded-full" style={{ background: s <= STATUS[m.status].step ? STATUS.demonstrated.color : "var(--ll-line)" }} />)}
                </span>
                {m.enough_evidence ? STATUS[m.status].label : m.attempts ? "Not enough evidence" : "Not assessed"}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="border-b border-line px-6 py-3.5 text-[16px] font-semibold">Your learning path</h2>
          <ul className="divide-y divide-line">
            {recs.items.slice(0, 6).map((r, i) => (
              <li key={i} className="px-6 py-3.5">
                <p className="text-[12.5px] text-muted">{KIND_LABEL[r.kind] ?? r.kind}</p>
                <Link to={`/learn/${r.concept}`} className="mt-0.5 flex items-center justify-between gap-3 text-[15px] font-medium text-ink hover:text-blue-ink">
                  {r.title} <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
                <p className="mt-0.5 text-[14px] text-muted">Why: {r.reason}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="border-b border-line px-6 py-3.5 text-[16px] font-semibold">Recent activity</h2>
          {rep.recent.length === 0 ? <p className="px-6 py-5 text-muted">No answers yet.</p> : (
            <ul className="divide-y divide-line">
              {[...rep.recent].reverse().slice(0, 6).map((a) => (
                <li key={a.response_id} className="flex items-start justify-between gap-4 px-6 py-3">
                  <span className="min-w-0">
                    <span className="num text-[13px] text-muted">{a.item_id}</span>
                    <span className="read block truncate text-[15px] text-ink-2">{a.answer}</span>
                  </span>
                  <GroupBadge group={a.group} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
