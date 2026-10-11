import { ArrowRight, ClipboardCheck, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonLink, ConceptTile, ErrorNote, GroupBadge, Loading, Panel, Stars } from "../components/ui";
import { api, type Concept, type Habit, type LearnerReport, type Recommendations } from "../lib/api";
import { STATUS } from "../lib/groups";
import { learnerName, useLearner } from "../lib/learner";

const KIND_LABEL: Record<string, string> = {
  misconception: "Wrong idea to fix", prerequisite: "Do this first", revise: "Practise", improving: "Improving", next: "Start here", practice: "Practise",
};

export default function Home() {
  const { learner } = useLearner();
  const [data, setData] = useState<{ rep: LearnerReport; recs: Recommendations; concepts: Map<string, Concept>; habits: Habit[] } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const id = learner!.learner_id;
    Promise.all([api.learnerReport(id), api.recommendations(id), api.concepts(), api.habits(id)])
      .then(([rep, recs, cs, h]) => setData({ rep, recs, concepts: new Map(cs.map((c) => [c.concept_id, c])), habits: h.habits }))
      .catch(setError);
  }, [learner]);

  if (error) return <div className="pt-10"><ErrorNote error={error} /></div>;
  if (!data) return <Loading what="your dashboard" />;
  const { rep, recs, concepts, habits } = data;
  const next = recs.next_lesson;
  const who = learnerName(learner);
  const answered = rep.concepts.reduce((s, c) => s + c.attempts, 0);

  return (
    <div className="pb-10 pt-8">
      <h1 className="text-[32px] font-extrabold">{who === "You" ? "Hi there!" : `Hi, ${who.replace(" (demo)", "")}!`}</h1>
      <p className="mt-1 text-[16px] text-muted">{answered ? `You've answered ${answered} ${answered === 1 ? "question" : "questions"}. Nice work! Here's what to do next.` : "Ready? Let's start with the very first idea in Simple Harmonic Motion."}</p>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel className="border-blue/30 bg-[linear-gradient(135deg,var(--ll-blue-soft),var(--ll-surface)_55%,var(--ll-sun-soft))] px-6 py-6">
          <p className="text-[14px] font-bold uppercase tracking-wide text-blue-ink">Up next for you</p>
          {next ? (
            <>
              <div className="mt-3 flex items-center gap-4">
                <ConceptTile id={next.concept} size="lg" />
                <p className="text-[24px] font-extrabold leading-tight text-ink">{concepts.get(next.concept)?.name}</p>
              </div>
              <p className="mt-3 text-[15px] text-ink-2">Why this: {next.reason}</p>
              <ButtonLink to={`/learn/${next.concept}`} className="mt-5 px-6 py-3 text-[16px]">Let's go <ArrowRight className="size-4" aria-hidden="true" /></ButtonLink>
            </>
          ) : (
            <p className="mt-2 text-[18px] text-ink">You've got every idea! Take the post-test to see how much you've grown.</p>
          )}
        </Panel>
        <Panel className="px-6 py-6">
          <p className="text-[14px] font-bold uppercase tracking-wide text-muted">Tests</p>
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

      {habits.length > 0 && (
        <Panel className="mt-6 border-sun/40 bg-sun-soft px-6 py-5">
          <h2 className="flex items-center gap-2 text-[17px] font-extrabold"><Lightbulb className="size-5 text-sun" aria-hidden="true" /> Habits to watch</h2>
          <ul className="mt-2 space-y-1.5 text-[15px] text-ink">
            {habits.map((h) => (
              <li key={h.code}><span className="font-bold">You've been {h.label}</span> on {h.count} questions. {h.tip}</li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="mt-6">
        <h2 className="border-b border-line px-6 py-3.5 text-[17px] font-extrabold">Your stars</h2>
        <ul className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
          {rep.concepts.map((m) => (
            <li key={m.concept} className="flex items-center justify-between gap-4 px-6 py-3 sm:border-b sm:border-line">
              <Link to={`/learn/${m.concept}`} className="flex min-w-0 items-center gap-3 text-[15px] font-semibold text-ink hover:text-blue-ink">
                <ConceptTile id={m.concept} size="sm" /><span className="truncate">{concepts.get(m.concept)?.name}</span>
              </Link>
              <span className="shrink-0" title={m.status_reason}>
                <Stars size="sm" step={m.enough_evidence ? STATUS[m.status].step : 0}
                  label={m.enough_evidence ? STATUS[m.status].label : m.attempts ? "Keep practising" : "Not started"} />
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="border-b border-line px-6 py-3.5 text-[17px] font-extrabold">Your learning path</h2>
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
          <h2 className="border-b border-line px-6 py-3.5 text-[17px] font-extrabold">Recent answers</h2>
          {rep.recent.length === 0 ? <p className="px-6 py-5 text-muted">No answers yet. Your first one will show up here.</p> : (
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
