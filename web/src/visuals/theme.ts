/** Light-theme tokens (always with fallbacks) and fixed physics series colours. */
export const C = {
  bg: "var(--ll-bg, #F5F9FF)",
  surface: "var(--ll-surface, #FFFFFF)",
  surface2: "var(--ll-surface-2, #EEF4FC)",
  line: "var(--ll-line, #D9E3F0)",
  ink: "var(--ll-ink, #0E2A47)",
  muted: "var(--ll-muted, #5A6B82)",
  blue: "var(--ll-blue, #2563EB)",
  blueSoft: "var(--ll-blue-soft, #DBEAFE)",
} as const;

export const SERIES = {
  displacement: "#2563EB",
  velocity: "#0D9488",
  acceleration: "#C2410C",
  kineticEnergy: "#0D9488",
  potentialEnergy: "#7C3AED",
  realImage: "#0E2A47",
  virtualImage: "#5A6B82",
  ray: "#D97706",
} as const;

/** Fixed-decimal number with a true minus sign and no "−0.00". */
export function fmt(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : "−∞";
  const s = Math.abs(n).toFixed(dp);
  return n < 0 && Number(s) !== 0 ? `−${s}` : s;
}

/** Like fmt but with an explicit "+" for positive values (sign-convention readouts). */
export function fmtSigned(n: number, dp = 2): string {
  const s = fmt(n, dp);
  return s.startsWith("−") || Number(Math.abs(n).toFixed(dp)) === 0 ? s : `+${s}`;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
