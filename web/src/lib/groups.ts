import type { Category, Group, MasteryStatus } from "./api";

/** How each answer group looks and reads. Colour is never the only signal: every group has a label and icon name. */
export const GROUPS: Record<Group, { label: string; short: string; color: string; soft: string; icon: GroupIcon }> = {
  A: { label: "Spot on!", short: "Correct", color: "var(--ll-a)", soft: "var(--ll-a-soft)", icon: "check" },
  B: { label: "Let's fix this idea", short: "Idea to fix", color: "var(--ll-b)", soft: "var(--ll-b-soft)", icon: "alert" },
  C: { label: "Tiny slip", short: "Slip", color: "var(--ll-c)", soft: "var(--ll-c-soft)", icon: "pencil" },
  D: { label: "Almost there", short: "Almost", color: "var(--ll-d)", soft: "var(--ll-d-soft)", icon: "half" },
  E: { label: "Tell me a bit more", short: "Need more", color: "var(--ll-e)", soft: "var(--ll-e-soft)", icon: "question" },
  F: { label: "Off the question", short: "Off-topic", color: "var(--ll-f)", soft: "var(--ll-f-soft)", icon: "off" },
};
export type GroupIcon = "check" | "alert" | "pencil" | "half" | "question" | "off";

const CATEGORY_GROUP: Record<Category, Group> = {
  SCIENTIFIC: "A",
  MISCONCEPTION: "B",
  FALSE_POSITIVE: "B",
  SLIP: "C",
  COMPUTATIONAL_SLIP: "C",
  FRAGILE: "D",
  PARTIAL: "D",
  LACK_OF_KNOWLEDGE: "D",
  AMBIGUOUS: "E",
  UNDIAGNOSED: "E",
  OFF_TOPIC: "F",
};
export const groupOf = (c: Category): Group => CATEGORY_GROUP[c];

export const STATUS: Record<MasteryStatus, { label: string; step: number; color: string }> = {
  not_assessed: { label: "Not started", step: 0, color: "var(--ll-line-strong)" },
  emerging: { label: "Just started", step: 1, color: "#93b4e8" },
  developing: { label: "Getting there", step: 2, color: "#4f83e6" },
  demonstrated: { label: "Got it!", step: 3, color: "var(--ll-blue-ink)" },
};

/** Confidence is a heuristic, never shown as a probability. */
export function confidenceWords(c: number | null): string | null {
  if (c === null) return null;
  if (c >= 0.85) return "The tutor is fairly sure about this.";
  if (c >= 0.65) return "The tutor thinks this is likely.";
  return "The tutor isn't sure; treat this as a guess to check.";
}

export const pct = (p: number) => `${Math.floor(p * 100)}%`;

/** One plain line that leads the feedback, per engine category. */
// Must match web/src/voice/speechLines.ts word for word: the audio was recorded from these lines.
export const HEADLINE: Record<Category, string> = {
  SCIENTIFIC: "That's right, and your reason holds up.",
  FRAGILE: "Right, even though you weren't sure.",
  PARTIAL: "Right answer. Now tell the tutor why.",
  FALSE_POSITIVE: "Right answer, but the reason is a common wrong idea.",
  MISCONCEPTION: "Not quite: this is a common wrong idea.",
  LACK_OF_KNOWLEDGE: "Not there yet. Let's look at it another way.",
  SLIP: "Your reasoning was right; the answer slipped.",
  COMPUTATIONAL_SLIP: "Right method, small slip in the working.",
  AMBIGUOUS: "The tutor needs one more detail.",
  UNDIAGNOSED: "The tutor couldn't tell, so this one doesn't count.",
  OFF_TOPIC: "Let's stay with the question.",
};

/** Learning objectives are written for teachers; say them to the student. */
export const forYou = (objective: string) => objective.replace(/^Students will be able to /, "You'll learn to ");
