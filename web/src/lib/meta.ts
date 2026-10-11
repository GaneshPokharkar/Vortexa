import type { Category, Zone } from "./api";

export type Tone = "green" | "amber" | "coral" | "teal" | "muted";

export const TONE_VAR: Record<Tone, string> = {
  green: "var(--green)",
  amber: "var(--amber)",
  coral: "var(--coral)",
  teal: "var(--teal)",
  muted: "var(--muted)",
};

/** What the learner reads after answering. Plain words; the rule id lives in the "Why" drawer. */
export const CATEGORY: Record<Category, { label: string; line: string; tone: Tone }> = {
  SCIENTIFIC: { label: "Correct", line: "Right answer, right reason, and you were sure.", tone: "green" },
  FRAGILE: {
    label: "Correct, but fragile",
    line: "Right answer and right reason, but you weren't sure. One more like this will settle it.",
    tone: "amber",
  },
  FALSE_POSITIVE: {
    label: "Right answer, wrong reason",
    line: "The answer is right, but the reason you picked is a common wrong idea. It doesn't count as learned yet.",
    tone: "coral",
  },
  MISCONCEPTION: {
    label: "Misconception",
    line: "Your answer and your reason both point to the same wrong idea. The card below takes it apart.",
    tone: "coral",
  },
  LACK_OF_KNOWLEDGE: {
    label: "Not there yet",
    line: "Wrong answer, and you weren't sure. Read the card, then try another question.",
    tone: "muted",
  },
  SLIP: {
    label: "Slip",
    line: "Your reason was right but the answer wasn't. A similar question comes next to check.",
    tone: "amber",
  },
  COMPUTATIONAL_SLIP: {
    label: "Calculation slip",
    line: "Right method, wrong number. A similar question comes next to check.",
    tone: "amber",
  },
  AMBIGUOUS: {
    label: "Need more info",
    line: "Your answer and your reason don't fit together yet. One short question will sort it out.",
    tone: "teal",
  },
  UNDIAGNOSED: {
    label: "Couldn't tell",
    line: "Your reasoning is still unclear, so this answer doesn't count either way.",
    tone: "muted",
  },
};

export const ZONES: Zone[] = ["Oscillations", "Waves", "Rays", "Light as a wave"];

/** Oscillations glow amber, waves teal, rays white like light rays, wave optics a blend of the two waves. */
export const ZONE_COLOR: Record<Zone, string> = {
  Oscillations: "#f2a541",
  Waves: "#2ec4b6",
  Rays: "#e6edf7",
  "Light as a wave": "#9ab97c", // midpoint of amber and teal: light is a wave again
};

/** Halo size and opacity for a node; grows with P(L), clamped to [0, 1]. */
export function glow(p: number): { blur: number; alpha: number } {
  const q = Math.min(1, Math.max(0, p));
  return { blur: Math.round(4 + 28 * q), alpha: +(0.15 + 0.7 * q).toFixed(3) };
}

export function pct(p: number): string {
  return `${Math.floor(p * 100)}%`; // floor: never show 100% before it is earned
}
