import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Lock, PartyPopper, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Confetti, ErrorNote, Loading, PageHeader, Panel } from "../components/ui";
import { api, type AssessmentKind, type AssessmentResult, type AssessmentSession, type LearnerReport, type TestTopic } from "../lib/api";
import { useLearner } from "../lib/learner";

type Answer = { option?: string; reason_id?: string; answer_text?: string };

/** Pre/post tests for one topic. `onFinished` lets the page show the report after a test. */
export default function Assessment({ topic = "ALL", title = "Your tests", practiceHref = "/home", reportHref = "#results", onRunning }: {
  topic?: TestTopic; title?: string; practiceHref?: string; reportHref?: string; onRunning?: (running: boolean) => void;
}) {
  const { learner } = useLearner();
  const learnerId = learner!.learner_id;
  const [report, setReport] = useState<LearnerReport | null>(null);
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { onRunning?.(Boolean(session && !result)); }, [session, result, onRunning]);
  const ReportLink = ({ children, variant }: { children: React.ReactNode; variant?: "secondary" }) => reportHref.startsWith("#")
    ? <Button variant={variant} className={variant ? "" : "px-5 py-3 text-[16px]"} onClick={() => document.querySelector(reportHref)?.scrollIntoView({ behavior: "smooth" })}>{children}</Button>
    : <ButtonLink to={reportHref} variant={variant} className={variant ? "" : "px-5 py-3 text-[16px]"}>{children}</ButtonLink>;

  const loadReport = () => api.learnerReport(learnerId, topic).then(setReport).catch(setError);
  useEffect(() => { loadReport(); }, [learnerId, topic]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (kind: AssessmentKind) => {
    setError(null);
    try {
      setSession(await api.startAssessment(learnerId, kind, topic));
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
    <div className="pb-10">
      <PageHeader title={title}>
        Same questions before and after you practise, scored the same way. That's how your report shows what changed.
        You won't see the answers during a test.
      </PageHeader>

      {result && (
        <Panel className="pop-in relative mb-8 overflow-hidden border-mint/40 bg-[linear-gradient(135deg,var(--ll-mint-soft),var(--ll-surface)_60%,var(--ll-sun-soft))] px-6 py-6">
          <Confetti />
          <div role="status" className="relative flex flex-wrap items-center gap-5">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-mint text-white" aria-hidden="true">
              <PartyPopper className="size-7" />
            </span>
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-[14px] font-bold uppercase tracking-wide text-mint">{result.kind === "pre" ? "Pre-test" : "Post-test"} saved</p>
              <p className="mt-1 text-[22px] font-extrabold leading-tight text-ink">
                You got <span className="num">{result.correct} of {result.total}</span> (<span className="num">{result.score_percentage}%</span>)
              </p>
              <p className="mt-1 text-[15px] text-ink-2">
                {result.kind === "pre" ? "Great, that's your starting point. Now practise, then take the post-test when you're ready." : "All done! Your report now shows the change."}
              </p>
            </div>
            {result.kind === "pre"
              ? <ButtonLink to={practiceHref} className="px-5 py-3 text-[16px]">Start practising <ArrowRight className="size-4" aria-hidden="true" /></ButtonLink>
              : <ReportLink>See my report <ArrowRight className="size-4" aria-hidden="true" /></ReportLink>}
          </div>
        </Panel>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <TestCard title="Pre-test" when="Before you practise" tone="sun" res={report.pre}
          action={!report.pre && <Button onClick={() => start("pre")} className="px-5 py-3 text-[16px]"><ClipboardCheck className="size-4" aria-hidden="true" /> Start the pre-test</Button>} />
        <TestCard title="Post-test" when="After you practise. Same questions." tone="grape" res={report.post}
          action={!report.post && (report.pre
            ? <Button onClick={() => start("post")} className="px-5 py-3 text-[16px]"><ClipboardCheck className="size-4" aria-hidden="true" /> Start the post-test</Button>
            : <p className="flex items-center gap-2 text-[15px] font-semibold text-muted"><Lock className="size-4" aria-hidden="true" /> Opens after you finish the pre-test.</p>)} />
      </div>
      {(!report.pre || !report.post) && <p className="mt-3 text-[14px] text-muted">Left a test halfway? Press start again and you'll pick up where you stopped.</p>}
      {report.pre && report.post && (
        <Panel className="mt-6 flex flex-wrap items-center gap-4 border-blue/30 bg-blue-soft/50 px-6 py-5">
          <TrendingUp className="size-6 text-blue-ink" aria-hidden="true" />
          <p className="flex-1 text-[16px] text-ink">
            Your change: <span className="num font-extrabold">{report.change_pp! > 0 ? "+" : ""}{report.change_pp} percentage points</span>
          </p>
          <ReportLink variant="secondary">See the full report</ReportLink>
        </Panel>
      )}
    </div>
  );
}

const TONE = {
  sun: { tile: "bg-sun-soft text-sun", pill: "bg-sun-soft text-[#9a5b00]" },
  grape: { tile: "bg-grape-soft text-grape", pill: "bg-grape-soft text-grape" },
};

function TestCard({ title, when, tone, res, action }: { title: string; when: string; tone: keyof typeof TONE; res: AssessmentResult | null; action: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <Panel className="px-6 py-6">
      <div className="flex items-start gap-4">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${t.tile}`} aria-hidden="true">
          <ClipboardCheck className="size-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[20px] font-extrabold">{title}</h2>
            {res
              ? <span className="inline-flex items-center gap-1 rounded-full bg-ga-soft px-2.5 py-0.5 text-[12.5px] font-bold text-ga"><CheckCircle2 className="size-3.5" aria-hidden="true" /> Done</span>
              : <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${t.pill}`}>Not taken yet</span>}
          </div>
          <p className="mt-0.5 text-[14.5px] text-muted">{when}</p>
        </div>
      </div>
      {res ? (
        <p className="mt-4 text-[16px] text-ink">
          You got <span className="num text-[22px] font-extrabold">{res.correct} of {res.total}</span> <span className="num text-muted">· {res.score_percentage}%</span>
        </p>
      ) : <div className="mt-5">{action}</div>}
    </Panel>
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

  const isAnswered = (idx: number) => saved.has(items[idx].item_id) || (idx === i && ready);
  const answeredCount = items.filter((_, idx) => isAnswered(idx)).length;
  const firstSkipped = items.findIndex((_, idx) => !isAnswered(idx));
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
      <nav aria-label="Jump to a question" className="mt-3 flex flex-wrap gap-1.5">
        {items.map((it, idx) => (
          <button key={it.item_id} type="button" disabled={busy} onClick={() => saveAndGo(idx)}
            aria-current={idx === i ? "step" : undefined} aria-label={`Question ${idx + 1}, ${isAnswered(idx) ? "answered" : "not answered yet"}`}
            className={`num size-8 rounded-full text-[13px] font-bold transition-colors ${
              isAnswered(idx) ? "bg-blue text-white" : "border-2 border-dashed border-sun bg-sun-soft text-[#9a5b00]"} ${
              idx === i ? "ring-2 ring-ink ring-offset-2" : ""}`}>
            {idx + 1}
          </button>
        ))}
      </nav>
      {answeredCount < items.length && (
        <p className="mt-2 text-[13px] text-muted">Dashed circles are questions you haven't answered yet. Tap one to go there.</p>
      )}

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
          answeredCount < items.length ? (
            <Button onClick={() => saveAndGo(firstSkipped)} disabled={busy}>
              Go to question {firstSkipped + 1} ({items.length - answeredCount} left) <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={busy}>Submit the test</Button>
          )
        ) : (
          <Button onClick={() => saveAndGo(i + 1)} disabled={busy}>{ready ? "Save and next" : "Skip for now"} <ArrowRight className="size-4" aria-hidden="true" /></Button>
        )}
      </div>
    </div>
  );
}
