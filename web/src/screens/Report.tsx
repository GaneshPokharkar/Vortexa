import { AlertTriangle, ArrowRight, Info, Repeat, Route, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonLink, ConceptTile, Empty, ErrorNote, GroupBadge, Loading, PageHeader, Panel, Stars } from "../components/ui";
import { api, type Concept, type LearnerReport, type Report as ClassReport, type TestTopic } from "../lib/api";
import { STATUS } from "../lib/groups";
import { useLearner } from "../lib/learner";

type Tab = "mine" | "class";

/** Scope of a report: one topic's tests and ideas, with links that stay inside that topic's workspace. */
type Scope = { topic: TestTopic; concepts?: string[]; base: string };

export default function Report({ topic = "ALL", concepts, base = "", embedded = false }: Partial<Scope> & { embedded?: boolean }) {
  const [tab, setTab] = useState<Tab>("mine");
  const scope = { topic, concepts, base };
  return (
    <div className={embedded ? "" : "pb-10"}>
      {!embedded && <PageHeader title="Your learning report">Your scores, what changed and why. We always tell you how many students a number is based on, and what it can't show.</PageHeader>}
      <div role="tablist" aria-label="Report" className="mb-6 inline-flex rounded-xl border-2 border-line bg-surface p-1">
        {([["mine", "My report"], ["class", "Class report"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-1.5 text-[15px] font-bold transition-colors ${tab === id ? "bg-blue text-white" : "text-ink-2 hover:bg-surface-2"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "mine" ? <Mine {...scope} /> : <ClassView {...scope} />}
    </div>
  );
}

const pp = (n: number) => `${n > 0 ? "+" : ""}${n} percentage points`;

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className={`rounded-2xl px-5 py-4 ${tone}`}>
      <p className="text-[14px] font-bold text-ink-2">{label}</p>
      <p className="num mt-1 text-[32px] font-extrabold leading-tight text-ink">{value}</p>
      <p className="text-[13.5px] text-muted">{sub}</p>
    </div>
  );
}

function Mine({ topic, concepts, base }: Scope) {
  const { learner } = useLearner();
  const inScope = (concept: string) => !concepts || concepts.includes(concept);
  const [r, setR] = useState<LearnerReport | null>(null);
  const [names, setNames] = useState<Map<string, Concept>>(new Map());
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    Promise.all([api.learnerReport(learner!.learner_id, topic), api.concepts()])
      .then(([rep, cs]) => { setR(rep); setNames(new Map(cs.map((c) => [c.concept_id, c]))); })
      .catch(setError);
  }, [learner, topic]);
  if (error) return <ErrorNote error={error} />;
  if (!r) return <Loading what="your report" />;
  const recent = r.recent.filter((a) => inScope(a.item_id.split("-")[0]));

  return (
    <div className="grid gap-6">
      <Panel className="grid gap-3 p-4 sm:grid-cols-3">
        {([["Pre-test", r.pre, "bg-sun-soft"], ["Post-test", r.post, "bg-grape-soft"]] as const).map(([label, res, tone]) => (
          <Stat key={label} label={label} tone={tone} value={res ? `${res.score_percentage}%` : "—"}
            sub={res ? `${res.correct} of ${res.total} correct` : "Not taken yet"} />
        ))}
        <Stat label="Change" tone="bg-blue-soft" value={r.change_pp === null ? "—" : `${r.change_pp > 0 ? "+" : ""}${r.change_pp}`}
          sub={r.change_pp === null ? "Needs both tests" : "percentage points (post % − pre %)"} />
      </Panel>
      {(!r.pre || !r.post) && (
        <p className="-mt-2 text-[15px] text-ink-2">
          {!r.pre ? "Take the pre-test to start your comparison." : "Take the post-test after practising to see the change."}{" "}
          <Link to={`${base}/test`} className="font-bold text-blue-ink underline-offset-2 hover:underline">Go to the tests</Link>
        </p>
      )}

      <Panel>
        <h2 className="border-b border-line px-6 py-3.5 text-[17px] font-extrabold">How each idea is going</h2>
        <ul className="divide-y divide-line">
          {r.concepts.filter((m) => inScope(m.concept)).map((m) => (
            <li key={m.concept} className="grid items-center gap-x-6 gap-y-1.5 px-6 py-3.5 md:grid-cols-[minmax(0,18rem)_13rem_minmax(0,1fr)]">
              <Link to={`${base}/learn/${m.concept}`} className="flex min-w-0 items-center gap-3 text-[15px] font-semibold text-ink hover:text-blue-ink">
                <ConceptTile id={m.concept} size="sm" /><span>{names.get(m.concept)?.name ?? m.concept}</span>
              </Link>
              <Stars size="sm" step={m.enough_evidence ? STATUS[m.status].step : 0}
                label={m.enough_evidence ? STATUS[m.status].label : m.attempts ? "Not enough evidence yet" : "Not assessed"} />
              <span className="text-[14px] text-muted">{m.status_reason}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="flex items-center gap-2 border-b border-line px-6 py-3.5 text-[17px] font-extrabold">
            <Route className="size-5 text-blue" aria-hidden="true" /> What to revise next
          </h2>
          {r.revision_path.filter((x) => inScope(x.concept)).length === 0 ? <p className="px-6 py-5 text-muted">Nothing yet. Answer a few questions first.</p> : (
            <ul className="divide-y divide-line">
              {r.revision_path.filter((x) => inScope(x.concept)).slice(0, 6).map((x, n) => (
                <li key={n} className="px-6 py-3.5">
                  <Link to={`${base}/learn/${x.concept}`} className="flex items-center justify-between gap-3 text-[15px] font-bold text-ink hover:text-blue-ink">
                    {x.title} <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                  </Link>
                  <p className="mt-0.5 text-[14px] text-muted">Why: {x.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <h2 className="flex items-center gap-2 border-b border-line px-6 py-3.5 text-[17px] font-extrabold">
            <Repeat className="size-5 text-coral" aria-hidden="true" /> Wrong ideas that keep coming back
          </h2>
          {r.repeated_misconceptions.filter((m) => inScope(m.concept)).length === 0 ? <p className="px-6 py-5 text-muted">None so far. No wrong idea has shown up more than once.</p> : (
            <ul className="divide-y divide-line">
              {r.repeated_misconceptions.filter((m) => inScope(m.concept)).map((m) => (
                <li key={m.code} className="flex items-start justify-between gap-3 px-6 py-3.5 text-[15px] text-ink">
                  <span>{m.description}</span>
                  <span className="num shrink-0 rounded-full bg-coral-soft px-2.5 py-0.5 text-[13px] font-bold text-ink">{m.count} times</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <h2 className="border-b border-line px-6 py-3.5 text-[17px] font-extrabold">Recent answers</h2>
        {recent.length === 0 ? <p className="px-6 py-5 text-muted">No answers yet. Your first one will show up here.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-[14.5px]">
              <thead className="text-[13px] font-bold text-muted">
                <tr><th className="px-6 py-2.5">Question</th><th className="px-3 py-2.5">Your answer</th><th className="px-3 py-2.5">Result</th><th className="px-6 py-2.5">Counted</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...recent].reverse().map((a) => (
                  <tr key={a.response_id}>
                    <td className="num px-6 py-2.5 text-muted">{a.item_id}{a.transfer ? " · application" : ""}</td>
                    <td className="read max-w-md px-3 py-2.5 text-ink-2">{a.answer}</td>
                    <td className="px-3 py-2.5"><GroupBadge group={a.group} /></td>
                    <td className="px-6 py-2.5 text-muted">{a.counted ? "Yes" : "No (unclear)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ClassView({ topic, base }: Scope) {
  const [demo, setDemo] = useState(false);
  const [r, setR] = useState<ClassReport | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { setR(null); api.report(demo, topic).then(setR).catch(setError); }, [demo, topic]);
  if (error) return <ErrorNote error={error} />;
  if (!r) return <Loading what="the class report" />;
  const preliminary = r.limitations.some((l) => /preliminary/i.test(l));

  return (
    <div className="grid gap-6">
      <Panel className="px-6 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-blue-soft text-blue-ink sm:grid" aria-hidden="true">
            <Users className="size-6" />
          </span>
          <p className="text-[16px] text-ink-2">
            <span className="num text-[30px] font-extrabold text-ink">n = {r.learners_completed_both}</span>{" "}
            {r.learners_completed_both === 1 ? "student" : "students"} completed both tests
          </p>
          {preliminary && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sun-soft px-3 py-1 text-[13px] font-bold text-[#9a5b00]">
              <AlertTriangle className="size-3.5" aria-hidden="true" /> Preliminary
            </span>
          )}
        </div>
        <p className="mt-3 text-[14.5px] text-muted">
          {r.learners_started_pre} started the pre-test · {r.learners_completed_pre} finished it · {r.questions} questions in each test
        </p>
        <label className="mt-4 inline-flex items-center gap-2 text-[14.5px] font-semibold text-ink-2">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="size-4 accent-[var(--ll-blue)]" />
          Include demo learners (not real students)
        </label>
      </Panel>

      {r.learners_completed_both === 0 ? (
        <Empty title="No matched pre/post results yet" action={<ButtonLink to={`${base}/test`} variant="secondary">Go to the tests</ButtonLink>}>
          A change is only reported for students who finished both tests.
        </Empty>
      ) : (
        <Panel className="grid gap-3 p-4 sm:grid-cols-3">
          <Stat label="Mean pre-test" tone="bg-sun-soft" value={`${r.pre_mean}%`} sub={`n = ${r.learners_completed_both}`} />
          <Stat label="Mean post-test" tone="bg-grape-soft" value={`${r.post_mean}%`} sub={`n = ${r.learners_completed_both}`} />
          <Stat label="Change" tone="bg-blue-soft" value={`${r.change_pp! > 0 ? "+" : ""}${r.change_pp}`} sub="percentage points (post % − pre %)" />
        </Panel>
      )}

      {r.per_concept.length > 0 && (
        <Panel>
          <h2 className="border-b border-line px-6 py-3.5 text-[17px] font-extrabold">By idea (matched students only)</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-[14.5px]">
              <thead className="text-[13px] font-bold text-muted"><tr><th className="px-6 py-2.5">Concept</th><th className="px-3 py-2.5">Pre</th><th className="px-3 py-2.5">Post</th><th className="px-6 py-2.5">Change</th></tr></thead>
              <tbody className="num divide-y divide-line">
                {r.per_concept.map((c) => (
                  <tr key={c.concept}>
                    <td className="px-6 py-2.5"><span className="inline-flex items-center gap-2"><ConceptTile id={c.concept} size="sm" />{c.concept}</span></td>
                    <td className="px-3 py-2.5">{c.pre}%</td><td className="px-3 py-2.5">{c.post}%</td><td className="px-6 py-2.5 font-bold">{pp(c.change_pp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {r.missing.length > 0 && (
        <Panel>
          <h2 className="border-b border-line px-6 py-3.5 text-[17px] font-extrabold">Missing or incomplete</h2>
          <ul className="divide-y divide-line">
            {r.missing.map((m, i) => <li key={i} className="px-6 py-2.5 text-[14.5px]"><span className="font-semibold text-ink">{m.learner}</span> <span className="text-muted">· {m.reason}</span></li>)}
          </ul>
        </Panel>
      )}

      <Panel className="border-sun/40 bg-sun-soft/50 px-6 py-5">
        <h2 className="flex items-center gap-2 text-[17px] font-extrabold"><Info className="size-5 text-sun" aria-hidden="true" /> Limitations</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14.5px] text-ink-2">
          {r.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </Panel>
    </div>
  );
}
