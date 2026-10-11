import { ArrowRight, Eye, Lightbulb, Repeat, Route, Sigma, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ConceptTile, ErrorNote, GroupBadge, Loading, Panel } from "../../components/ui";
import { api, type Habit, type LearnerReport, type TopicSummary } from "../../lib/api";
import { ConceptStars, useTopic } from "./TopicLayout";

/** Summary & My Progress: revision sheet for the topic plus the learner's own evidence-based progress. */
export default function SummaryView() {
  const { learnerId, topic, concepts, mastery } = useTopic();
  const [data, setData] = useState<{ sum: TopicSummary; rep: LearnerReport; habits: Habit[] } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const base = `/topic/${topic.topic_id}`;

  useEffect(() => {
    Promise.all([api.topicSummary(topic.topic_id), api.learnerReport(learnerId, topic.topic_id), api.habits(learnerId)])
      .then(([sum, rep, h]) => setData({ sum, rep, habits: h.habits })).catch(setError);
  }, [learnerId, topic.topic_id]);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading what="your summary" />;
  const ids = new Set(concepts.map((c) => c.concept_id));
  const inTopic = (itemOrConcept: string) => ids.has(itemOrConcept.split("-")[0]);
  const struggling = concepts.filter((c) => {
    const m = mastery.get(c.concept_id);
    return m && m.attempts > 0 && (m.status === "emerging" || m.status === "developing" || !m.enough_evidence);
  });
  const revise = data.rep.revision_path.filter((r) => inTopic(r.concept)).slice(0, 5);
  const repeated = data.rep.repeated_misconceptions.filter((m) => inTopic(m.concept));
  const recent = [...data.rep.recent].reverse().filter((a) => inTopic(a.item_id)).slice(0, 6);
  const draft = data.sum.concepts.some((c) => !c.reviewed);

  return (
    <div className="grid gap-6">
      <section aria-labelledby="progress">
        <h2 id="progress" className="text-[20px] font-extrabold">My progress in {topic.title}</h2>
        <p className="mt-1 text-[14.5px] text-muted">Stars come only from questions you answered: never from saying you understand.</p>
        <ul className="mt-3 grid gap-2.5 md:grid-cols-2">
          {concepts.map((c) => {
            const m = mastery.get(c.concept_id);
            return (
              <li key={c.concept_id}>
                <Link to={`${base}/learn/${c.concept_id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[0_2px_0_var(--ll-line)] hover:border-blue">
                  <ConceptTile id={c.concept_id} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{c.name}</span>
                    <span className="mt-0.5 block"><ConceptStars m={m} /></span>
                    {m && m.attempts > 0 && <span className="mt-0.5 block text-[12.5px] text-muted">{m.status_reason}</span>}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h3 className="flex items-center gap-2 border-b border-line px-5 py-3 text-[16px] font-extrabold"><Route className="size-5 text-blue" aria-hidden="true" /> What to revise next</h3>
          {struggling.length === 0 && revise.length === 0 ? (
            <p className="px-5 py-4 text-[15px] text-muted">Nothing yet. Answer a few practice questions and your plan appears here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {struggling.map((c) => (
                <li key={c.concept_id} className="px-5 py-3">
                  <Link to={`${base}/learn/${c.concept_id}?s=see`} className="flex items-center justify-between gap-3 text-[15px] font-bold text-ink hover:text-blue-ink">
                    Needs work: {c.name} <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                  </Link>
                  <p className="text-[13.5px] text-muted">Start from the simulation, then try the questions again.</p>
                </li>
              ))}
              {revise.map((r, n) => (
                <li key={n} className="px-5 py-3">
                  <Link to={`${base}/learn/${r.concept}`} className="flex items-center justify-between gap-3 text-[15px] font-bold text-ink hover:text-blue-ink">
                    {r.title} <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                  </Link>
                  <p className="text-[13.5px] text-muted">Why: {r.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <h3 className="flex items-center gap-2 border-b border-line px-5 py-3 text-[16px] font-extrabold"><Repeat className="size-5 text-coral" aria-hidden="true" /> Mistakes you keep making</h3>
          {repeated.length === 0 && data.habits.length === 0 ? (
            <p className="px-5 py-4 text-[15px] text-muted">None so far. Nothing has shown up on more than one question.</p>
          ) : (
            <ul className="divide-y divide-line text-[15px]">
              {repeated.map((m) => (
                <li key={m.code} className="flex items-start justify-between gap-3 px-5 py-3"><span>{m.description}</span>
                  <span className="num shrink-0 rounded-full bg-coral-soft px-2.5 py-0.5 text-[12.5px] font-bold">{m.count} times</span></li>
              ))}
              {data.habits.map((h) => (
                <li key={h.code} className="flex items-start gap-2 px-5 py-3"><Lightbulb className="mt-0.5 size-4 shrink-0 text-sun" aria-hidden="true" />
                  <span><b>Habit:</b> {h.label} ({h.count} questions). {h.tip}</span></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {recent.length > 0 && (
        <Panel>
          <h3 className="border-b border-line px-5 py-3 text-[16px] font-extrabold">My recent answers</h3>
          <ul className="divide-y divide-line">
            {recent.map((a) => (
              <li key={a.response_id} className="flex items-start justify-between gap-4 px-5 py-2.5">
                <span className="min-w-0"><span className="num text-[12.5px] text-muted">{a.item_id}</span>
                  <span className="read block truncate text-[14.5px] text-ink-2">{a.answer}</span></span>
                <GroupBadge group={a.group} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <section aria-labelledby="sheet" className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 id="sheet" className="flex items-center gap-2 border-b border-line px-5 py-3 text-[17px] font-extrabold"><Sigma className="size-5 text-blue" aria-hidden="true" /> Formula sheet</h2>
          <div className="divide-y divide-line">
            {data.sum.concepts.map((c) => (
              <div key={c.concept_id} className="px-5 py-3.5">
                <p className="text-[13px] font-bold text-muted">{c.name}</p>
                <dl className="mt-1.5 space-y-2.5">
                  {c.equations.map((e) => (
                    <div key={e.expr}>
                      <dt className="math text-[18px] text-ink">{e.expr}</dt>
                      <dd className="m-0 text-[13.5px] text-muted">
                        {e.meaning && <span className="block text-ink-2">{e.meaning}</span>}
                        {Object.entries(e.vars).map(([k, v]) => <span key={k} className="mr-3 inline-block"><span className="math text-ink-2">{k}</span> {v}</span>)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <h2 className="flex items-center gap-2 border-b border-line px-5 py-3 text-[17px] font-extrabold"><TriangleAlert className="size-5 text-coral" aria-hidden="true" /> Common mistakes and the fix</h2>
          <ul className="divide-y divide-line">
            {data.sum.concepts.flatMap((c) => c.mistakes.map((m) => (
              <li key={m.code} className="px-5 py-3">
                <p className="text-[15px] text-ink"><span className="font-bold text-gb">Not:</span> {m.wrong_idea}</p>
                {m.correct_idea && <p className="mt-0.5 text-[15px] text-ink"><span className="font-bold text-ga">Instead:</span> {m.correct_idea}</p>}
                {m.why_wrong && <p className="mt-0.5 text-[13.5px] text-muted">{m.why_wrong}</p>}
              </li>
            )))}
          </ul>
        </Panel>
      </section>

      <Panel>
        <h2 className="border-b border-line px-5 py-3 text-[17px] font-extrabold">Key ideas in one line each</h2>
        <ul className="divide-y divide-line">
          {data.sum.concepts.map((c) => (
            <li key={c.concept_id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3.5">
              <ConceptTile id={c.concept_id} size="sm" />
              <span className="min-w-0 flex-1 basis-64">
                <span className="block text-[15px] font-bold text-ink">{c.name}</span>
                <span className="read block text-[15px] text-ink-2">{c.definition}</span>
              </span>
              {c.visual && (
                <Link to={`${base}/learn/${c.concept_id}?s=see`} className="inline-flex items-center gap-1.5 rounded-xl border-2 border-line px-3 py-1.5 text-[14px] font-bold text-ink hover:border-blue hover:text-blue-ink">
                  <Eye className="size-4" aria-hidden="true" /> Open the simulation
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <h2 className="border-b border-line px-5 py-3 text-[17px] font-extrabold">Doubts worth checking</h2>
        <p className="px-5 pt-3 text-[13.5px] text-muted">Questions the content authors expect students to ask (not a count of what students asked).</p>
        <div className="divide-y divide-line px-5 pb-2">
          {data.sum.concepts.flatMap((c) => c.doubts.map((d) => (
            <details key={c.concept_id + d.q} className="group py-2.5">
              <summary className="cursor-pointer list-none text-[15px] font-bold text-ink marker:hidden">{d.q}</summary>
              <p className="read mt-1.5 text-[15px] text-ink-2">{d.a}</p>
            </details>
          )))}
        </div>
      </Panel>

      {draft && <p className="text-[13px] text-muted">Content is a draft awaiting teacher review; nothing here claims a textbook citation.</p>}
    </div>
  );
}
