import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, ButtonLink, ErrorNote, Loading, PageHeader } from "../components/ui";
import { api, type AssessmentKind, type AssessmentResult, type AssessmentSession, type LearnerReport } from "../lib/api";
import { useLearner } from "../lib/learner";

type Answer = { option?: string; reason_id?: string; answer_text?: string };

export default function Assessment() {
  const { learner } = useLearner();
  const learnerId = learner!.learner_id;
  const [report, setReport] = useState<LearnerReport | null>(null);
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<unknown>(null);

  const loadReport = () => api.learnerReport(learnerId).then(setReport).catch(setError);
  useEffect(() => { loadReport(); }, [learnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (kind: AssessmentKind) => {
    setError(null);
    try {
      setSession(await api.startAssessment(learnerId, kind));
    } catch (e) {
      setError(e);
    }
  };

  if (session && !result) {
    return <TestRunner session={session} onDone={(r) => { setResult(r); setSession(null); loadReport(); }} />;
  }

  if (error) return <div className="pt-10"><ErrorNote error={error} /></div>;
  if (!report) return <Loading what="your tests" />;

  return (
    <div>
      <PageHeader title="Pre-test and post-test">
        The same questions before and after practice, scored the same way, so your report can show what changed.
        You won't see answers during a test.
      </PageHeader>

      {result && (
        <div role="status" className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-ga/30 bg-ga-soft px-5 py-4">
          <CheckCircle2 className="size-5 text-ga" aria-hidden="true" />
          <p className="flex-1 text-[15.5px] text-ink">
            {result.kind === "pre" ? "Pre-test" : "Post-test"} saved: <span className="num font-semibold">{result.correct} of {result.total}</span>{" "}
            (<span className="num">{result.score_percentage}%</span>).{" "}
            {result.kind === "pre" ? "Now practise; take the post-test when you're ready." : "Your report now shows the change."}
          </p>
          {result.kind === "pre" ? <ButtonLink to="/topics" variant="secondary">Start practising</ButtonLink>
            : <ButtonLink to="/report" variant="secondary">See my report</ButtonLink>}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <TestCard title="Pre-test" when="Before you practise" res={report.pre}
          action={!report.pre && <Button onClick={() => start("pre")}><ClipboardCheck className="size-4" aria-hidden="true" /> Start or resume the pre-test</Button>} />
        <TestCard title="Post-test" when="After practice, same questions" res={report.post}
          action={!report.post && (report.pre
            ? <Button onClick={() => start("post")}><ClipboardCheck className="size-4" aria-hidden="true" /> Start or resume the post-test</Button>
            : <p className="text-[14.5px] text-muted">Opens after you finish the pre-test.</p>)} />
      </div>
      {report.pre && report.post && (
        <p className="mt-6 text-[15px] text-ink-2">
          Change: <span className="num font-semibold">{report.change_pp! > 0 ? "+" : ""}{report.change_pp} percentage points</span>.{" "}
          <Link to="/report" className="text-blue-ink underline-offset-2 hover:underline">Open the full report</Link>
        </p>
      )}
    </div>
  );
}

function TestCard({ title, when, res, action }: { title: string; when: string; res: AssessmentResult | null; action: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface px-5 py-5">
      <p className="text-[13.5px] text-muted">{when}</p>
      <h2 className="mt-1 text-[19px] font-semibold">{title}</h2>
      {res ? (
        <p className="mt-3 text-[15.5px] text-ink">
          Done: <span className="num font-semibold">{res.correct} of {res.total}</span> · <span className="num">{res.score_percentage}%</span>
        </p>
      ) : <div className="mt-4">{action}</div>}
    </section>
  );
}

function TestRunner({ session, onDone }: { session: AssessmentSession; onDone: (r: AssessmentResult) => void }) {
  const items = session.items;
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set(session.answered));
  const [i, setI] = useState(() => Math.max(0, items.findIndex((it) => !session.answered.includes(it.item_id))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const item = items[i];
  const a = answers[item.item_id] ?? {};
  const ready = item.kind === "mcq" ? Boolean(a.option) : Boolean(a.answer_text?.trim());
  const set = (patch: Answer) => setAnswers((all) => ({ ...all, [item.item_id]: { ...a, ...patch } }));

  const saveAndGo = async (to: number) => {
    setError(null);
    if (ready) {
      setBusy(true);
      try {
        await api.answerAssessment(session.session_id, { item_id: item.item_id, ...a });
        setSaved((s) => new Set(s).add(item.item_id));
      } catch (e) {
        setError(e);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setI(to);
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      if (ready && !saved.has(item.item_id)) await api.answerAssessment(session.session_id, { item_id: item.item_id, ...a });
      onDone(await api.completeAssessment(session.session_id));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const answeredCount = new Set([...saved, ...(ready ? [item.item_id] : [])]).size;
  const last = i === items.length - 1;

  return (
    <div className="mx-auto max-w-3xl pb-10 pt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-[22px] font-semibold">{session.kind === "pre" ? "Pre-test" : "Post-test"}</h1>
        <p className="num text-[14px] text-muted">Question {i + 1} of {items.length} · {answeredCount} answered</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={answeredCount} aria-label="Answered">
        <div className="h-full rounded-full bg-blue transition-[width]" style={{ width: `${(100 * answeredCount) / items.length}%` }} />
      </div>

      <section className="mt-6 rounded-xl border border-line bg-surface px-5 py-6 sm:px-7">
        <p className="read text-[19px] leading-snug text-ink">{item.stem}</p>
        {item.kind === "mcq" ? (
          <>
            <fieldset className="mt-5">
              <legend className="text-[14px] font-medium text-ink-2">Your answer</legend>
              <div className="mt-2 grid gap-2">
                {Object.entries(item.options).map(([k, v]) => (
                  <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5 text-[15.5px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue ${
                    a.option === k ? "border-blue bg-blue-soft/60" : "border-line hover:border-line-strong"}`}>
                    <input type="radio" name={`t-${item.item_id}`} className="sr-only" checked={a.option === k} onChange={() => set({ option: k })} />
                    <span className="num text-muted">{k}</span><span>{v}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="text-[14px] font-medium text-ink-2">Why? <span className="font-normal text-muted">(optional, used for the reasoning score)</span></legend>
              <div className="mt-2 grid gap-2">
                {Object.entries(item.reasons).map(([k, v]) => (
                  <label key={k} className={`cursor-pointer rounded-lg border px-3.5 py-2 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue ${
                    a.reason_id === k ? "border-blue bg-blue-soft/60" : "border-line hover:border-line-strong"}`}>
                    <input type="radio" name={`tr-${item.item_id}`} className="sr-only" checked={a.reason_id === k} onChange={() => set({ reason_id: k })} />
                    {v}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <label className="mt-5 block">
            <span className="text-[14px] font-medium text-ink-2">Your answer</span>
            <textarea value={a.answer_text ?? ""} onChange={(e) => set({ answer_text: e.target.value })} rows={3}
              className="read mt-2 w-full rounded-lg border border-line-strong px-3.5 py-2.5 text-[16px] focus:border-blue focus:outline-none" />
          </label>
        )}
      </section>

      {error ? <div className="mt-4"><ErrorNote error={error} /></div> : null}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" disabled={i === 0 || busy} onClick={() => saveAndGo(i - 1)}><ArrowLeft className="size-4" aria-hidden="true" /> Back</Button>
        {last ? (
          <Button onClick={finish} disabled={busy || answeredCount < items.length}>
            {answeredCount < items.length ? `Answer all ${items.length} to submit` : "Submit the test"}
          </Button>
        ) : (
          <Button onClick={() => saveAndGo(i + 1)} disabled={busy}>{ready ? "Save and next" : "Skip for now"} <ArrowRight className="size-4" aria-hidden="true" /></Button>
        )}
      </div>
    </div>
  );
}
