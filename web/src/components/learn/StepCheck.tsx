import { ArrowRight, BookOpen, Calculator, Eye, Lightbulb, PlayCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Feedback, type RemediationCard, type StepCheck, type StepReview } from "../../lib/api";
import { Button, ErrorNote } from "../ui";

/** Lets the step check open the lesson column on its simulation or solved example. */
export type LessonLinks = { hasVisual: boolean; show: (mode: "visual" | "worked") => void };

export function StepCheckPanel({ fb, check, onUpdate, onNext, links }: {
  fb: Feedback; check: StepCheck; onUpdate: (fb: Feedback) => void; onNext: (itemId?: string | null) => void; links?: LessonLinks;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [working, setWorking] = useState("");
  const a = check.analysis;
  const rv = check.review;
  const tone = a?.code ? "border-gb bg-gb-soft" : "border-gc bg-gc-soft";

  useEffect(() => { setWorking(""); }, [fb.response_id]);

  const reveal = async () => {
    setBusy(true);
    setError(null);
    try {
      onUpdate(await api.revealStep(fb.response_id));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const send = async (step: number, text?: string) => {
    setBusy(true);
    setError(null);
    try {
      onUpdate(await api.pickStep(fb.response_id, step, text?.trim() || undefined));
      setWorking("");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-line bg-bg px-4 py-4">
      <p className="text-[15.5px] font-semibold text-ink">Where did your working go off track?</p>
      <p className="mt-1 text-[14px] text-ink-2">
        {check.revealed ? "The tutor showed you where. Tap a step to compare it with your own working."
          : a ? "Tap a different step to compare again." : "Here is the full working. Tap the first step that doesn't match what you did."}
      </p>
      {!a && check.traceable && (
        <button type="button" disabled={busy} onClick={reveal}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[14px] font-bold text-blue-ink hover:bg-blue-soft disabled:opacity-50">
          <Eye className="size-4" aria-hidden="true" /> Just show me where I went wrong
        </button>
      )}
      <ol className="mt-3 space-y-2">
        {check.steps.map((text, i) => {
          const n = i + 1;
          const fine = a !== null && n < a.step;
          return (
            <li key={n}>
              <button type="button" disabled={busy} onClick={() => send(n)} aria-pressed={check.picked === n}
                className={`flex w-full items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors disabled:cursor-wait ${
                  a?.step === n ? tone : check.picked === n ? "border-blue bg-blue-soft/60" : "border-line bg-surface hover:border-line-strong"}`}>
                <span className={`num mt-px w-4 shrink-0 text-[14px] ${fine ? "text-ga" : "text-muted"}`}>
                  {fine ? <><span aria-hidden="true">✓</span><span className="sr-only">Step {n}, fine</span></> : n}
                </span>
                <span className="flex-1">
                  <span className={`read block text-[15.5px] ${a && n > a.step ? "text-muted" : "text-ink"}`}>{text}</span>
                  {(check.picked === n || check.traced === n) && (
                    <span className="mt-1 flex flex-wrap gap-1.5 text-[12.5px]">
                      {check.picked === n && <span className="rounded-full bg-blue-soft px-2 py-0.5 text-blue-ink">You picked this</span>}
                      {check.traced === n && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-2">Your answer points here</span>}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {a && (
        <div aria-live="polite" className={`mt-3 space-y-1 rounded-lg border px-3.5 py-3 ${tone}`}>
          {a.lines.map((l) => <p key={l} className="read text-[15px] text-ink">{l}</p>)}
        </div>
      )}

      {rv && <Review rv={rv} onNext={onNext} links={links} />}

      {check.picked !== null && (
        <form className="mt-3" onSubmit={(e) => { e.preventDefault(); if (working.trim()) send(check.picked!, working); }}>
          <label htmlFor={`work-${fb.response_id}`} className="text-[14px] font-semibold text-ink-2">
            {rv?.needs_detail ? rv.question : "What did you do at this step? (optional)"}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input id={`work-${fb.response_id}`} value={working} onChange={(e) => setWorking(e.target.value)} maxLength={300}
              placeholder={rv?.working ? `You wrote: ${rv.working}` : "e.g. I took 12 cm as the amplitude"} autoFocus={rv?.needs_detail}
              className="min-w-0 flex-1 rounded-xl border-2 border-line bg-surface px-3 py-2 text-[15px] focus:border-blue focus:outline-none" />
            <Button type="submit" variant="secondary" disabled={busy || !working.trim()}><Send className="size-4" aria-hidden="true" /> Send</Button>
          </div>
        </form>
      )}
      {error ? <div className="mt-3"><ErrorNote error={error} /></div> : null}
    </div>
  );
}

function Review({ rv, onNext, links }: { rv: StepReview; onNext: (itemId?: string | null) => void; links?: LessonLinks }) {
  const [card, setCard] = useState<RemediationCard | null>(null);
  const idea = rv.kind === "conceptual";
  useEffect(() => { setCard(null); }, [rv.card_id]);

  if (rv.needs_detail) {
    return (
      <p className="mt-3 rounded-lg border border-ge/25 bg-ge-soft/60 px-3.5 py-3 text-[15px] text-ink">
        The tutor isn't sure yet whether this was an idea or a slip. Answer the question below and it will tell you.
      </p>
    );
  }
  return (
    <div className={`mt-3 rounded-xl border-2 px-4 py-3.5 ${idea ? "border-grape/30 bg-grape-soft" : "border-sun/40 bg-sun-soft"}`}>
      <p className="flex items-center gap-2 text-[15.5px] font-extrabold text-ink">
        {idea ? <Lightbulb className="size-5 text-grape" aria-hidden="true" /> : <Calculator className="size-5 text-sun" aria-hidden="true" />}
        {idea ? "This is an idea to fix, not a calculation slip." : "Your idea was fine. This was a calculation slip."}
      </p>
      {idea && rv.idea && <p className="mt-1.5 text-[14.5px] text-ink-2">The idea behind it: {rv.idea}</p>}
      {rv.explanation && <p className="read mt-1.5 text-[15px] text-ink">{rv.explanation}</p>}
      {!idea && rv.habit && <p className="mt-1.5 text-[14.5px] text-ink-2"><span className="font-bold text-ink">Tip:</span> {rv.habit.tip}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {idea ? (
          <>
            {links?.hasVisual && (
              <Button onClick={() => links.show("visual")}><PlayCircle className="size-4" aria-hidden="true" /> Watch it in the simulation</Button>
            )}
            {links && <Button variant="secondary" onClick={() => links.show("worked")}>See a solved example</Button>}
            {rv.card_id && !card && (
              <Button variant="ghost" onClick={() => api.card(rv.card_id!).then((c) => setCard(c as RemediationCard))}>
                <BookOpen className="size-4" aria-hidden="true" /> Why this idea doesn't work
              </Button>
            )}
          </>
        ) : (
          <Button onClick={() => onNext(rv.practice_item_id)}>Try a similar question <ArrowRight className="size-4" aria-hidden="true" /></Button>
        )}
      </div>
      {card && (
        <div className="mt-3 rounded-lg bg-surface px-3.5 py-3">
          <p className="read text-[15px] italic text-ink-2">“{card.wrong_idea}”</p>
          <p className="mt-1 text-[14.5px] text-ink-2"><span className="font-medium text-ink">Why it's wrong:</span> {card.why_wrong}</p>
          <p className="mt-1 text-[14.5px] text-ink"><span className="font-medium">The idea that works:</span> {card.statement}</p>
        </div>
      )}
    </div>
  );
}
