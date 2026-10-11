import { useId, useState, type ReactNode } from "react";
import { VisualStyles } from "../controls";
import { C } from "../theme";

/** The student's idea is always dashed in this colour; physics is always solid. */
export const IDEA = "#B42318";
export const TRUTH = "#0E2A47";
export const TRUTH_RAY = "#D97706";

export type Layers = { idea: boolean; truth: boolean };
type Show = "both" | "idea" | "truth";

export function OverlayFrame({ title, ideaLabel, truthLabel, caption, children }: {
  title: string;
  ideaLabel: string;
  truthLabel: string;
  caption: string;
  children: (layers: Layers) => ReactNode;
}) {
  const [show, setShow] = useState<Show>("both");
  const name = useId();
  const layers = { idea: show !== "truth", truth: show !== "idea" };
  const options: [Show, string][] = [["both", "Both"], ["idea", "Your idea"], ["truth", "Physics"]];

  return (
    <section
      aria-label={title}
      className="flex w-full flex-col gap-3 rounded-xl p-3 sm:p-4"
      style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}
    >
      <VisualStyles />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
          <li className="flex items-center gap-2">
            <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke={IDEA} strokeWidth="2.5" strokeDasharray="5 4" /></svg>
            <span style={{ color: IDEA }}>{ideaLabel}</span>
          </li>
          <li className="flex items-center gap-2">
            <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke={TRUTH} strokeWidth="2.5" /></svg>
            <span>{truthLabel}</span>
          </li>
        </ul>
        <fieldset className="m-0 flex rounded-lg border p-0.5" style={{ borderColor: C.line }}>
          <legend className="sr-only">Show</legend>
          {options.map(([v, label]) => (
            <label
              key={v}
              className="llv-focus cursor-pointer rounded-md px-2.5 py-1 text-sm has-[:focus-visible]:outline-2"
              style={{ background: show === v ? C.blueSoft : "transparent", color: show === v ? C.blue : C.ink }}
            >
              <input type="radio" name={name} value={v} checked={show === v} onChange={() => setShow(v)} className="sr-only" />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
      {children(layers)}
      <p className="m-0 rounded-lg px-3 py-2 text-sm" style={{ background: C.surface2 }}>{caption}</p>
    </section>
  );
}
