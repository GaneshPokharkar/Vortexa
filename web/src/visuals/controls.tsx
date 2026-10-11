import { useId, type ReactNode } from "react";
import { C } from "./theme";

/** Scoped styles: visible focus rings, range accent colour, tabular numbers. */
const CSS = `
.llv-focus:focus-visible{outline:3px solid ${C.blue};outline-offset:2px;border-radius:6px}
.llv-range{accent-color:${C.blue};width:100%;min-height:28px;cursor:pointer}
.llv-num{font-variant-numeric:tabular-nums}
.llv-btn{background:${C.blue};color:#FFFFFF;border:1px solid ${C.blue};border-radius:8px;padding:6px 14px;font-weight:600;min-height:36px;cursor:pointer}
.llv-btn:hover{filter:brightness(1.08)}
.llv-select{background:${C.surface};color:${C.ink};border:1px solid ${C.line};border-radius:8px;padding:6px 8px;min-height:36px;width:100%}
.llv-check{accent-color:${C.blue};width:18px;height:18px;cursor:pointer}
`;

export function VisualStyles() {
  return <style>{CSS}</style>;
}

/** Outer card shared by all visuals. */
export function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className="w-full rounded-xl p-3 sm:p-4 flex flex-col gap-3"
      style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}
    >
      <VisualStyles />
      {children}
    </section>
  );
}

interface RangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** text shown next to the label, e.g. "0.15 m" */
  display: string;
  /** spoken value, defaults to display */
  valueText?: string;
}

export function RangeControl({ label, value, min, max, step, onChange, display, valueText }: RangeProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="flex justify-between gap-2 text-sm" style={{ color: C.ink }}>
        <span>{label}</span>
        <span className="llv-num font-semibold">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        className="llv-range llv-focus"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText ?? display}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}

/** Read-only labelled value. */
export function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg px-2 py-1.5 min-w-0" style={{ background: C.surface2 }}>
      <dt className="text-xs" style={{ color: C.muted }}>
        {label}
      </dt>
      <dd className="llv-num text-sm font-semibold m-0" style={{ color: color ?? C.ink }}>
        {value}
      </dd>
    </div>
  );
}

/** Note/callout line. */
export function Callout({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <p
      className="text-sm rounded-lg px-3 py-2 m-0"
      style={{
        background: strong ? C.blueSoft : C.surface2,
        color: C.ink,
        borderLeft: `4px solid ${strong ? C.blue : C.line}`,
      }}
    >
      {children}
    </p>
  );
}
