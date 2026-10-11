import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type Why } from "../../lib/api";
import { ErrorNote, GroupBadge, Loading } from "../ui";

const ENGINE: Record<string, string> = { rules: "rules", claude: "Claude", "rules+claude": "rules + Claude", physics: "physics code" };

/** "Why this diagnosis?": the three agents, the rule that fired and the evidence, in plain words. */
export function WhyDrawer({ responseId, onClose }: { responseId: number; onClose: () => void }) {
  const [why, setWhy] = useState<Why | null>(null);
  const [error, setError] = useState<unknown>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    api.why(responseId).then(setWhy).catch(setError);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [responseId, onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-labelledby="why-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto border-l border-line bg-surface p-6 shadow-[0_0_40px_rgb(14_42_71/0.12)]">
        <div className="flex items-start justify-between gap-4">
          <h2 id="why-title" className="text-[20px] font-semibold">Why this diagnosis?</h2>
          <button ref={closeRef} onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-[14.5px] text-muted">Three agents looked at your answer. Fixed rules made the final call.</p>
        {error ? <div className="mt-4"><ErrorNote error={error} /></div> : null}
        {!why && !error && <Loading what="the trace" />}
        {why && (
          <>
            <div className="mt-5"><GroupBadge group={why.group} size="lg" /></div>
            <ol className="mt-5 space-y-4">
              {why.pipeline.map((s, i) => (
                <li key={s.stage} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
                  <span className="grid size-7 place-items-center rounded-full border border-line-strong text-[13px] font-semibold text-blue-ink">{i + 1}</span>
                  <div>
                    <p className="font-medium text-ink">{s.agent} <span className="text-[13px] font-normal text-muted">· {ENGINE[s.engine] ?? s.engine}</span></p>
                    <p className="mt-0.5 text-[14.5px] text-ink-2">{s.outcome}</p>
                  </div>
                </li>
              ))}
            </ol>
            <h3 className="mt-6 text-[15px] font-semibold">Evidence</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[14.5px] text-ink-2">
              {why.evidence.map((e) => <li key={e}>{e}</li>)}
            </ul>
            <h3 className="mt-6 text-[15px] font-semibold">Rule that decided</h3>
            <p className="mt-1 text-[14.5px] text-ink-2"><span className="num text-[13px] text-muted">{why.rule_fired}</span><br />{why.rule_text}</p>
            <p className="mt-6 border-t border-line pt-4 text-[13px] text-muted">
              {why.classifier_confidence === null ? "No confidence score: the rules matched directly." :
                `Tutor confidence ${why.classifier_confidence.toFixed(2)} (a heuristic, not a probability).`}
              {why.clarifications ? ` Clarifying questions asked: ${why.clarifications}.` : ""}
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
