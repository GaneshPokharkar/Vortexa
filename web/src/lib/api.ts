// Thin typed client. Every call goes through the Vite proxy at /api.

export type Concept = { concept_id: string; name: string; zone: Zone; summary: string };
export type Zone = "Oscillations" | "Waves" | "Rays" | "Light as a wave";

export type PublicItem = {
  item_id: string;
  concept: string;
  stem: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  reasons: Record<"r1" | "r2" | "r3", string>;
};

export type Category =
  | "SCIENTIFIC" | "FRAGILE" | "FALSE_POSITIVE" | "MISCONCEPTION" | "LACK_OF_KNOWLEDGE"
  | "SLIP" | "COMPUTATIONAL_SLIP" | "AMBIGUOUS" | "UNDIAGNOSED";

export type Feedback = {
  response_id: number;
  category: Category;
  rule_fired: string;
  rule_text: string;
  misconception_code: string | null;
  misconception_status: "SUSPECTED" | "CONFIRMED" | null;
  remediation_card_id: string;
  followup_item_ids: string[];
  sibling_scheduled: boolean;
  needs_clarification: boolean;
  clarify: { probes: string[]; reasons: Record<string, string>; remaining: number } | null;
  mastery: { concept: string; p_learned: number };
};

export type Why = {
  response_id: number;
  item_id: string;
  category: Category;
  rule_fired: string;
  rule_text: string;
  distractor_map_entry: Record<string, string>;
  reason: { reason_id: string; maps_to: string } | null;
  reason_text: string | null;
  classifier_confidence: number | null;
  clarifications: number;
  misconception_status: string | null;
};

export type ConceptMastery = {
  concept: string;
  p_learned: number;
  attempts: number;
  distinct_items: number;
  last_correct: boolean;
  mastered: boolean;
  misconceptions: Record<string, "SUSPECTED" | "CONFIRMED">;
  history: number[];
};

export type Card = {
  card_id: string;
  concept: string;
  code: string | null;
  statement: string;
  analogy: string;
  steps: string[];
  worked_example: string;
  wrong_idea: string;
  why_it_feels_right: string;
  why_wrong: string;
  sim_moment: string;
  verify_flags: string[];
};

export class ApiError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the WaveLoop server. Start it with: uvicorn api.main:app");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(typeof body?.detail === "string" ? body.detail : `Server answered ${res.status}.`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  concepts: () => call<Concept[]>("/concepts"),
  nextItem: (learnerId: string, concept?: string) =>
    call<{ item: PublicItem | null }>(
      `/items/next?learner_id=${encodeURIComponent(learnerId)}${concept ? `&concept=${concept}` : ""}`,
    ),
  respond: (body: {
    learner_id: string;
    item_id: string;
    option: string;
    reason_id?: string;
    reason_text?: string;
    confidence: "sure" | "unsure";
  }) => call<Feedback>("/responses", { method: "POST", body: JSON.stringify(body) }),
  clarify: (body: { response_id: number; reason_id?: string; text?: string }) =>
    call<Feedback>("/clarify", { method: "POST", body: JSON.stringify(body) }),
  mastery: (learnerId: string) =>
    call<{ learner_id: string; concepts: ConceptMastery[] }>(`/mastery/${encodeURIComponent(learnerId)}`),
  card: (cardId: string) => call<Card>(`/explain/${encodeURIComponent(cardId)}`),
  why: (responseId: number) => call<Why>(`/diagnosis/${responseId}/why`),
};
