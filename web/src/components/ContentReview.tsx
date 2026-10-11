import { useEffect, useState } from "react";
import { api, type ReviewData } from "../lib/api";
import { ErrorNote, Loading } from "./ui";

/** Teacher-only: every question with its answer key, option-to-idea map, working and review flags. */
export function ContentReview({ token }: { token: string }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { api.review(token).then(setData).catch(setError); }, [token]);
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading what="the content" />;

  const flagged = data.items.filter((i) => i.verify_flags.length).length;
  return (
    <div className="grid gap-6">
      <p className="text-[15px] text-ink-2">
        <span className="num font-semibold">{flagged} of {data.items.length}</span> questions still carry review flags. Edit the files in
        <span className="num"> data/content/</span>, then run <span className="num">python scripts/load_content.py</span> to rebuild and re-check them.
      </p>
      {data.concepts.map((c) => (
        <details key={c.concept_id} className="rounded-xl border border-line bg-surface" open={c.concept_id === "C2"}>
          <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-3 px-5 py-4">
            <span className="text-[16px] font-medium text-ink"><span className="num mr-1.5 text-muted">{c.concept_id}</span>{c.name}</span>
            <span className="text-[13.5px] text-muted">{c.review_status === "verified" ? "Reviewed" : "Awaiting review"} · {c.verify_items} flagged questions</span>
          </summary>
          <div className="border-t border-line px-5 py-4">
            <h3 className="text-[14px] font-semibold text-ink-2">Misconceptions</h3>
            <ul className="mt-2 space-y-1 text-[14.5px] text-ink-2">
              {data.misconceptions.filter((m) => m.concept === c.concept_id).map((m) => (
                <li key={m.code}><span className="num mr-1.5 font-medium text-ink">{m.code}</span>{m.description}</li>
              ))}
            </ul>
            <h3 className="mt-5 text-[14px] font-semibold text-ink-2">Questions</h3>
            <ul className="mt-2 divide-y divide-line">
              {data.items.filter((i) => i.concept === c.concept_id).map((i) => (
                <li key={i.item_id} className="py-3.5">
                  <p className="text-[13px] text-muted">
                    <span className="num">{i.item_id}</span> · {i.kind === "mcq" ? "multiple choice" : "short answer"}
                    {i.is_assessment ? " · pre/post test" : ""}{i.transfer ? " · application" : ""}
                  </p>
                  <p className="read mt-1 text-[16px] text-ink">{i.stem}</p>
                  {i.kind === "mcq" && i.options && i.distractor_map ? (
                    <ul className="mt-2 grid gap-1 text-[14px] sm:grid-cols-2">
                      {Object.entries(i.options).map(([k, v]) => (
                        <li key={k} className={k === i.correct ? "text-ga" : "text-ink-2"}>
                          <span className="num mr-1">{k}</span>{v} <span className="num text-muted">→ {i.distractor_map![k]}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[14px] text-ink-2"><span className="text-ga">Key:</span> {i.answer_key}{" "}
                      <span className="text-muted">· ideas caught: {i.patterns.map((p) => p.code).join(", ") || "none"}</span></p>
                  )}
                  {i.calc && <p className="num mt-1 text-[13px] text-muted">Working: {i.calc}</p>}
                  {i.verify_flags.length > 0 && (
                    <ul className="mt-1.5 list-disc pl-5 text-[13px] text-gc">
                      {i.verify_flags.map((f) => <li key={f}>{f === "TODO_VERIFY" ? "Not yet checked by a physics teacher" : f}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ))}
    </div>
  );
}
