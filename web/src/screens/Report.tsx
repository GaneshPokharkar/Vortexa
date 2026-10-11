import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonLink, Empty, ErrorNote, GroupBadge, Loading, PageHeader, Panel } from "../components/ui";
import { api, type Concept, type LearnerReport, type Report as ClassReport } from "../lib/api";
import { STATUS } from "../lib/groups";
import { useLearner } from "../lib/learner";

type Tab = "mine" | "class";

export default function Report() {
  const [tab, setTab] = useState<Tab>("mine");
  return (
    <div>
      <PageHeader title="Learning report">Scores, what changed and why, with the sample size and limits stated plainly.</PageHeader>
      <div role="tablist" aria-label="Report" className="mb-6 inline-flex rounded-lg border border-line bg-surface p-1">
        {([["mine", "My report"], ["class", "Class report"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`rounded-md px-3.5 py-1.5 text-[14.5px] ${tab === id ? "bg-blue-soft font-medium text-blue-ink" : "text-ink-2 hover:bg-surface-2"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "mine" ? <Mine /> : <ClassView />}
    </div>
  );
}

const pp = (n: number) => `${n > 0 ? "+" : ""}${n} percentage points`;

function Mine() {
  const { learner } = useLearner();
  const [r, setR] = useState<LearnerReport | null>(null);
  const [names, setNames] = useState<Map<string, Concept>>(new Map());
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    Promise.all([api.learnerReport(learner!.learner_id), api.concepts()])
      .then(([rep, cs]) => { setR(rep); setNames(new Map(cs.map((c) => [c.concept_id, c]))); })
      .catch(setError);
  }, [learner]);
  if (error) return <ErrorNote error={error} />;
  if (!r) return <Loading what="your report" />;

  return (
    <div className="grid gap-6">
      <Panel className="grid gap-6 px-6 py-6 md:grid-cols-3">
        {[["Pre-test", r.pre], ["Post-test", r.post]].map(([label, res]) => (
          <div key={label as string}>
            <p className="text-[14px] text-muted">{label as string}</p>
            <p className="num mt-1 text-[30px] font-semibold text-ink">{res ? `${(res as { score_percentage: number }).score_percentage}%` : "—"}</p>
            <p className="text-[13.5px] text-muted">{res ? `${(res as { correct: number }).correct} of ${(res as { total: number }).total} correct` : "Not taken yet"}</p>
          </div>
        ))}
        <div>
          <p className="text-[14px] text-muted">Change</p>
          <p className="num mt-1 text-[30px] font-semibold text-ink">{r.change_pp === null ? "—" : `${r.change_pp > 0 ? "+" : ""}${r.change_pp}`}</p>
          <p className="text-[13.5px] text-muted">{r.change_pp === null ? "Needs both tests" : "percentage points (post % − pre %)"}</p>
        </div>
      </Panel>
      {(!r.pre || !r.post) && (
        <p className="-mt-2 text-[14.5px] text-muted">
          {!r.pre ? "Take the pre-test to start your comparison." : "Take the post-test after practising to see the change."}{" "}
          <Link to="/assessment" className="text-blue-ink underline-offset-2 hover:underline">Go to the tests</Link>
        </p>
      )}

      <Panel>
        <h2 className="border-b border-line px-6 py-3.5 text-[16px] font-semibold">Concept progress</h2>
        <ul className="divide-y divide-line">
          {r.concepts.map((m) => (
            <li key={m.concept} className="grid gap-x-6 gap-y-1 px-6 py-3.5 md:grid-cols-[minmax(0,18rem)_10rem_minmax(0,1fr)]">
              <Link to={`/learn/${m.concept}`} className="text-[15px] text-ink hover:text-blue-ink">
                <span className="num mr-1.5 text-muted">{m.concept}</span>{names.get(m.concept)?.name}
              </Link>
              <span className="text-[14px] font-medium" style={{ color: STATUS[m.status].step >= 2 ? "var(--ll-blue-ink)" : "var(--ll-ink-2)" }}>
                {m.enough_evidence ? STATUS[m.status].label : m.attempts ? "Not enough evidence yet" : "Not assessed"}
              </span>
              <span className="text-[14px] text-muted">{m.status_reason}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="border-b border-line px-6 py-3.5 text-[16px] font-semibold">What to revise next</h2>
          {r.revision_path.length === 0 ? <p className="px-6 py-5 text-muted">Nothing yet. Answer a few questions first.</p> : (
            <ul className="divide-y divide-line">
              {r.revision_path.slice(0, 6).map((x, n) => (
                <li key={n} className="px-6 py-3.5">
                  <Link to={`/learn/${x.concept}`} className="flex items-center justify-between gap-3 text-[15px] font-medium text-ink hover:text-blue-ink">
                    {x.title} <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                  </Link>
                  <p className="mt-0.5 text-[14px] text-muted">Why: {x.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <h2 className="border-b border-line px-6 py-3.5 text-[16px] font-semibold">Ideas that keep coming back</h2>
          {r.repeated_misconceptions.length === 0 ? <p className="px-6 py-5 text-muted">No idea has shown up more than once.</p> : (
            <ul className="divide-y divide-line">
              {r.repeated_misconceptions.map((m) => (
                <li key={m.code} className="px-6 py-3.5 text-[15px] text-ink">
                  {m.description} <span className="num text-[13.5px] text-muted">· {m.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <h2 className="border-b border-line px-6 py-3.5 text-[16px] font-semibold">Recent answers</h2>
        {r.recent.length === 0 ? <p className="px-6 py-5 text-muted">No answers yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14.5px]">
              <thead className="text-[13px] text-muted">
                <tr><th className="px-6 py-2.5 font-normal">Question</th><th className="px-3 py-2.5 font-normal">Your answer</th><th className="px-3 py-2.5 font-normal">Result</th><th className="px-6 py-2.5 font-normal">Counted</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...r.recent].reverse().map((a) => (
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

function ClassView() {
  const [demo, setDemo] = useState(false);
  const [r, setR] = useState<ClassReport | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { setR(null); api.report(demo).then(setR).catch(setError); }, [demo]);
  if (error) return <ErrorNote error={error} />;
  if (!r) return <Loading what="the class report" />;

  return (
    <div className="grid gap-6">
      <Panel className="px-6 py-6">
        <p className="text-[15px] text-ink-2">
          <span className="num text-[30px] font-semibold text-ink">n = {r.learners_completed_both}</span>{" "}
          {r.learners_completed_both === 1 ? "student" : "students"} completed both tests
        </p>
        <p className="mt-2 text-[14.5px] text-muted">
          {r.learners_started_pre} started the pre-test · {r.learners_completed_pre} finished it · {r.questions} questions in each test
        </p>
        <label className="mt-4 inline-flex items-center gap-2 text-[14px] text-ink-2">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="size-4 accent-[var(--ll-blue)]" />
          Include demo learners (not real students)
        </label>
      </Panel>

      {r.learners_completed_both === 0 ? (
        <Empty title="No matched pre/post results yet" action={<ButtonLink to="/assessment" variant="secondary">Go to the tests</ButtonLink>}>
          A change is only reported for students who finished both tests.
        </Empty>
      ) : (
        <Panel className="grid gap-6 px-6 py-6 md:grid-cols-3">
          <div><p className="text-[14px] text-muted">Mean pre-test</p><p className="num mt-1 text-[26px] font-semibold">{r.pre_mean}%</p></div>
          <div><p className="text-[14px] text-muted">Mean post-test</p><p className="num mt-1 text-[26px] font-semibold">{r.post_mean}%</p></div>
          <div><p className="text-[14px] text-muted">Change</p><p className="num mt-1 text-[26px] font-semibold">{pp(r.change_pp!)}</p></div>
        </Panel>
      )}

      {r.per_concept.length > 0 && (
        <Panel>
          <h2 className="border-b border-line px-6 py-3.5 text-[16px] font-semibold">By concept (matched students)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14.5px]">
              <thead className="text-[13px] text-muted"><tr><th className="px-6 py-2.5 font-normal">Concept</th><th className="px-3 py-2.5 font-normal">Pre</th><th className="px-3 py-2.5 font-normal">Post</th><th className="px-6 py-2.5 font-normal">Change</th></tr></thead>
              <tbody className="num divide-y divide-line">
                {r.per_concept.map((c) => (
                  <tr key={c.concept}><td className="px-6 py-2.5">{c.concept}</td><td className="px-3 py-2.5">{c.pre}%</td><td className="px-3 py-2.5">{c.post}%</td><td className="px-6 py-2.5">{pp(c.change_pp)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {r.missing.length > 0 && (
        <Panel>
          <h2 className="border-b border-line px-6 py-3.5 text-[16px] font-semibold">Missing or incomplete</h2>
          <ul className="divide-y divide-line">
            {r.missing.map((m, i) => <li key={i} className="px-6 py-2.5 text-[14.5px]"><span className="text-ink">{m.learner}</span> <span className="text-muted">· {m.reason}</span></li>)}
          </ul>
        </Panel>
      )}

      <Panel className="px-6 py-5">
        <h2 className="text-[16px] font-semibold">Limitations</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14.5px] text-ink-2">
          {r.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </Panel>
    </div>
  );
}
