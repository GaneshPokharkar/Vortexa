import { useState } from "react";
import { api, type Feedback, type StepCheck } from "../../lib/api";
import { ErrorNote } from "../ui";

export function StepCheckPanel({ fb, check, onUpdate }: { fb: Feedback; check: StepCheck; onUpdate: (fb: Feedback) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const a = check.analysis;
  const tone = a?.code ? "border-gb bg-gb-soft" : "border-gc bg-gc-soft";

  const choose = async (step: number) => {
    setBusy(true);
    setError(null);
    try {
      onUpdate(await api.pickStep(fb.response_id, step));
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
        {a ? "Tap a different step to compare again." : "Here is the full working. Tap the first step that doesn't match what you did."}
      </p>
      <ol className="mt-3 space-y-2">
        {check.steps.map((text, i) => {
          const n = i + 1;
          const fine = a !== null && n < a.step;
          return (
            <li key={n}>
              <button type="button" disabled={busy} onClick={() => choose(n)} aria-pressed={check.picked === n}
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
      {error ? <div className="mt-3"><ErrorNote error={error} /></div> : null}
    </div>
  );
}
