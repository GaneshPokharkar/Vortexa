import { ArrowRight, BookOpen, MessageCircleQuestion, Users } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, type Feedback, type PublicItem, type RemediationCard } from "../../lib/api";
import { HEADLINE, confidenceWords } from "../../lib/groups";
import { CorrectionVisual } from "../../visuals";
import { DialoguePanel } from "../DialoguePanel";
import { Button, Empty, ErrorNote, GroupBadge, Loading } from "../ui";
import { WhyDrawer } from "./WhyDrawer";

type Stage = { kind: "loading" } | { kind: "none" } | { kind: "question"; item: PublicItem } | { kind: "feedback"; item: PublicItem; fb: Feedback };

export function PracticePanel({ learnerId, conceptId, onAnswered }: { learnerId: string; conceptId: string; onAnswered: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (itemId?: string | null) => {
    setStage({ kind: "loading" });
    setError(null);
    try {
      const item = itemId ? await api.getItem(itemId) : (await api.nextItem(learnerId, conceptId)).item;
      setStage(item ? { kind: "question", item } : { kind: "none" });
    } catch (e) {
      setError(e);
    }
  }, [learnerId, conceptId]);

  useEffect(() => { load(); }, [load]);

  const done = (item: PublicItem, fb: Feedback) => {
    setStage({ kind: "feedback", item, fb });
    onAnswered();
  };

  if (error) return <ErrorNote error={error} onRetry={() => load()} />;
  if (stage.kind === "loading") return <Loading what="a question" />;
  if (stage.kind === "none") return <Empty title="No practice questions left here">You've worked through this concept's questions. Try another concept or the post-test.</Empty>;

  return (
    <div className="flex flex-col gap-4">
      <QuestionCard item={stage.item} learnerId={learnerId} locked={stage.kind === "feedback"} onResult={(fb) => done(stage.item, fb)}
        answered={stage.kind === "feedback" ? stage.fb.your_answer : null} />
      {stage.kind === "feedback" && (
        <FeedbackCard fb={stage.fb} learnerId={learnerId} conceptId={conceptId} onNext={(id) => load(id)}
          onUpdate={(fb) => done(stage.item, fb)} />
      )}
    </div>
  );
}

/* ---------------- question ---------------- */

function Choice({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5 text-[15.5px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue ${
      checked ? "border-blue bg-blue-soft/60 text-ink" : "border-line bg-surface text-ink hover:border-line-strong"}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

function QuestionCard({ item, learnerId, locked, answered, onResult }: {
  item: PublicItem; learnerId: string; locked: boolean; answered: string | null; onResult: (fb: Feedback) => void;
}) {
  const [option, setOption] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<"sure" | "unsure" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => { setOption(null); setReason(null); setText(""); setConfidence(null); setError(null); }, [item.item_id]);

  const ready = item.kind === "short"
    ? text.trim().length > 0
    : option && confidence && (reason !== null && (reason !== "own" || text.trim()));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      onResult(await api.respond(item.kind === "short"
        ? { learner_id: learnerId, item_id: item.item_id, answer_text: text.trim(), ...(confidence ? { confidence } : {}) }
        : { learner_id: learnerId, item_id: item.item_id, option: option!, confidence: confidence!,
            ...(reason === "own" ? { reason_text: text.trim() } : { reason_id: reason! }) }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-surface px-5 py-5 sm:px-6">
      <p className="text-[13.5px] text-muted">
        Practice · {item.kind === "short" ? "short answer" : "choose an answer, then a reason"}{item.transfer ? " · application question" : ""}
      </p>
      <p className="read mt-2 text-[19px] leading-snug text-ink">{item.stem}</p>

      {locked ? (
        <p className="read mt-4 rounded-lg border border-line bg-bg px-3.5 py-2.5 text-[16px] text-ink-2">{answered}</p>
      ) : item.kind === "short" ? (
        <label className="mt-4 block">
          <span className="sr-only">Your answer</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Your answer, with a reason…"
            className="read w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-[16px] text-ink placeholder:text-muted focus:border-blue focus:outline-none" />
        </label>
      ) : (
        <div className="mt-4 space-y-5">
          <fieldset>
            <legend className="text-[14px] font-medium text-ink-2">1 · Your answer</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.entries(item.options).map(([k, v]) => (
                <Choice key={k} name={`opt-${item.item_id}`} checked={option === k} onChange={() => setOption(k)}>
                  <span className="num text-muted">{k}</span><span>{v}</span>
                </Choice>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={!option} className={option ? "" : "opacity-50"}>
            <legend className="text-[14px] font-medium text-ink-2">2 · Why?</legend>
            <div className="mt-2 grid gap-2">
              {Object.entries(item.reasons).map(([k, v]) => (
                <Choice key={k} name={`why-${item.item_id}`} checked={reason === k} onChange={() => setReason(k)}><span>{v}</span></Choice>
              ))}
              <Choice name={`why-${item.item_id}`} checked={reason === "own"} onChange={() => setReason("own")}>
                <span className="text-muted">Explain in my own words</span>
              </Choice>
              {reason === "own" && (
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="Your reason"
                  className="read rounded-lg border border-line-strong px-3.5 py-2 text-[16px] focus:border-blue focus:outline-none" />
              )}
            </div>
          </fieldset>
        </div>
      )}

      {!locked && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">How sure are you?</legend>
            <span className="text-[14px] text-ink-2">{item.kind === "mcq" ? "3 · How sure are you?" : "How sure are you? (optional)"}</span>
            {(["sure", "unsure"] as const).map((c) => (
              <label key={c} className={`cursor-pointer rounded-full border px-3 py-1 text-[14px] has-[:focus-visible]:outline-2 ${
                confidence === c ? "border-blue bg-blue-soft text-blue-ink" : "border-line text-ink-2 hover:border-line-strong"}`}>
                <input type="radio" name={`conf-${item.item_id}`} className="sr-only" checked={confidence === c} onChange={() => setConfidence(c)} />
                {c === "sure" ? "Sure" : "Not sure"}
              </label>
            ))}
          </fieldset>
          <Button type="submit" disabled={!ready || busy}>{busy ? "Checking…" : "Check my answer"}</Button>
        </div>
      )}
      {error ? <div className="mt-4"><ErrorNote error={error} /></div> : null}
    </form>
  );
}

/* ---------------- feedback ---------------- */

function FeedbackCard({ fb, learnerId, conceptId, onNext, onUpdate }: {
  fb: Feedback; learnerId: string; conceptId: string; onNext: (itemId?: string | null) => void; onUpdate: (fb: Feedback) => void;
}) {
  const [why, setWhy] = useState(false);
  const [talk, setTalk] = useState(false);
  const [card, setCard] = useState<RemediationCard | null>(null);
  const borderByGroup: Record<string, string> = { A: "border-ga/40", B: "border-gb/35", C: "border-gc/40", D: "border-gd/35", E: "border-ge/35", F: "border-line" };
  const sure = confidenceWords(fb.confidence);
  const closeWhy = useCallback(() => setWhy(false), []);

  const showCard = async () => {
    const c = await api.card(fb.remediation_card_id);
    setCard(c as RemediationCard);
  };

  return (
    <section aria-live="polite" className={`overflow-hidden rounded-xl border bg-surface ${borderByGroup[fb.group]}`}>
      <div className="px-5 pt-5 sm:px-6">
        <GroupBadge group={fb.group} size="lg" />
        <p className="mt-3 text-[21px] font-semibold leading-snug text-ink">{HEADLINE[fb.category]}</p>
        <p className="read mt-2 text-[16.5px] text-ink-2">{fb.feedback_text}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[14.5px] text-ink-2">
          {fb.evidence.map((e) => <li key={e}>{e}</li>)}
          {sure && <li>{sure}</li>}
          {fb.misconception_status === "CONFIRMED" && <li>This idea has now shown up on two different questions.</li>}
        </ul>
        {fb.correct_answer && <p className="mt-3 text-[14.5px] text-ink-2"><span className="text-muted">Answer:</span> {fb.correct_answer}</p>}
      </div>

      {fb.visual_correction && <div className="px-5 pt-4 sm:px-6"><CorrectionVisual correction={fb.visual_correction} /></div>}

      {fb.follow_up && fb.follow_up.kind === "clarify" ? (
        <Clarify fb={fb} onUpdate={onUpdate} />
      ) : fb.follow_up ? (
        <div className="px-5 py-5 sm:px-6">
          <p className="text-[14px] text-muted">{fb.follow_up.kind === "transfer" ? "Next: an application question" : "Tutor asks next"}</p>
          <p className="read mt-1 text-[17px] text-ink">{fb.follow_up.prompt}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 px-5 pb-5 sm:px-6">
        {fb.follow_up?.kind !== "clarify" && (
          <Button onClick={() => onNext(fb.follow_up?.item_id)}>
            {fb.follow_up?.item_id ? "Try the next question" : "Next question"} <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        )}
        {fb.misconception_code && (
          <Button variant="secondary" onClick={() => setTalk(true)}><Users className="size-4" aria-hidden="true" /> Talk it through with Rohan</Button>
        )}
        {fb.misconception_code && !card && (
          <Button variant="ghost" onClick={showCard}><BookOpen className="size-4" aria-hidden="true" /> Why this idea doesn't work</Button>
        )}
        <Button variant="ghost" onClick={() => setWhy(true)}><MessageCircleQuestion className="size-4" aria-hidden="true" /> Why this diagnosis?</Button>
      </div>

      {card && (
        <div className="mx-5 mb-5 rounded-lg bg-surface-2 px-4 py-3.5 sm:mx-6">
          <p className="read text-[16px] italic text-ink-2">“{card.wrong_idea}”</p>
          {card.why_it_feels_right && <p className="mt-2 text-[14.5px] text-ink-2"><span className="font-medium text-ink">Why it feels right:</span> {card.why_it_feels_right}</p>}
          <p className="mt-1 text-[14.5px] text-ink-2"><span className="font-medium text-ink">Why it's wrong:</span> {card.why_wrong}</p>
          <p className="mt-1 text-[14.5px] text-ink"><span className="font-medium">The idea that works:</span> {card.statement}</p>
        </div>
      )}

      <p className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line bg-bg px-5 py-3 text-[12.5px] text-muted sm:px-6">
        {fb.pipeline.map((s, i) => (
          <span key={s.stage}>{i > 0 && <span aria-hidden="true" className="mr-3">→</span>}{s.agent} · {s.engine === "rules+claude" ? "rules + Claude" : s.engine}</span>
        ))}
      </p>

      {talk && fb.misconception_code && (
        <div className="border-t border-line p-4"><DialoguePanel learnerId={learnerId} conceptId={conceptId} code={fb.misconception_code} /></div>
      )}
      {why && <WhyDrawer responseId={fb.response_id} onClose={closeWhy} />}
    </section>
  );
}

function Clarify({ fb, onUpdate }: { fb: Feedback; onUpdate: (fb: Feedback) => void }) {
  const [text, setText] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const reasons = fb.clarify?.reasons ?? {};

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onUpdate(await api.clarify({ response_id: fb.response_id, ...(reason ? { reason_id: reason } : { text: text.trim() }) }));
      setText("");
      setReason(null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={send} className="px-5 py-5 sm:px-6">
      {(fb.clarify?.probes ?? [fb.follow_up?.prompt]).filter(Boolean).map((p) => (
        <p key={p} className="read rounded-lg border-l-2 border-ge bg-ge-soft/50 px-4 py-2.5 text-[17px] text-ink">{p}</p>
      ))}
      {Object.keys(reasons).length > 0 && (
        <div className="mt-3 grid gap-2">
          {Object.entries(reasons).map(([k, v]) => (
            <Choice key={k} name={`clar-${fb.response_id}`} checked={reason === k} onChange={() => { setReason(k); setText(""); }}><span>{v}</span></Choice>
          ))}
        </div>
      )}
      <label className="mt-3 block">
        <span className="sr-only">Your reply</span>
        <textarea value={text} onChange={(e) => { setText(e.target.value); if (e.target.value) setReason(null); }} rows={2}
          placeholder="Your reply…" className="read w-full rounded-lg border border-line-strong px-3.5 py-2 text-[16px] focus:border-blue focus:outline-none" />
      </label>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">
          {fb.clarify?.remaining === 1 ? "Last chance to clarify" : `${fb.clarify?.remaining ?? 2} chances to clarify`}. Typing that you understand never changes your progress.
        </span>
        <Button type="submit" disabled={busy || (!reason && !text.trim())}>{busy ? "Sending…" : "Send"}</Button>
      </div>
      {error ? <div className="mt-3"><ErrorNote error={error} /></div> : null}
    </form>
  );
}
