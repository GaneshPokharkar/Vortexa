// LearnLoop AI API contract. Backend changes and this file change in the same commit.
// Every call goes through the Vite proxy at /api (FastAPI on :8000).

/* ---------------- shared ---------------- */

export type TopicId = "SHM" | "OPTICS";
export type Confidence = "sure" | "unsure";

/** Engine categories (fine-grained). Screens should mostly show `group` (A–F) instead. */
export type Category =
  | "SCIENTIFIC" | "FRAGILE" | "PARTIAL" | "FALSE_POSITIVE" | "MISCONCEPTION" | "LACK_OF_KNOWLEDGE"
  | "SLIP" | "COMPUTATIONAL_SLIP" | "AMBIGUOUS" | "OFF_TOPIC" | "UNDIAGNOSED";

/** The six answer groups required by the problem statement. */
export type Group = "A" | "B" | "C" | "D" | "E" | "F";
export const GROUP_LABEL: Record<Group, string> = {
  A: "Correct understanding",
  B: "Likely misconception",
  C: "Possible slip",
  D: "Partly correct",
  E: "Needs clarification",
  F: "Off-topic or unsupported",
};

/* ---------------- curriculum ---------------- */

export type Topic = { topic_id: TopicId; title: string; description: string; primary: boolean; concepts: string[] };

export type Concept = {
  concept_id: string; // "C1".."C5" SHM, "C6","C7" Optics
  name: string;
  topic_id: TopicId;
  subtopic: string;
  summary: string;
  learning_objective: string;
  review_status: "needs_review" | "verified";
};

export type Equation = { expr: string; meaning: string; vars: Record<string, string>; assumptions: string };

export type ConceptCard = {
  card_id: string; // "<concept>-K"
  concept: string;
  statement: string;
  simple: string; // beginner explanation
  formal: string; // scientifically formal explanation
  equations: Equation[];
  analogy: string;
  steps: string[];
  worked_example: string;
  alternatives: string[]; // used when the first explanation didn't help
  visual: "shm-oscillator" | "lens-bench" | "refraction" | "";
  source: string;
  verify_flags: string[]; // non-empty => show "requires academic review"
};

export type RemediationCard = {
  card_id: string; // "<code>-R"
  concept: string;
  code: string;
  statement: string; // the idea that works
  wrong_idea: string;
  why_it_feels_right: string;
  why_wrong: string;
  sim_moment: string;
  verify_flags: string[];
};

export type ExplainMode = "beginner" | "steps" | "worked" | "analogy" | "visual" | "practice";

export type Lesson = {
  concept: Concept;
  card: ConceptCard;
  misconceptions: { code: string; description: string; remediation_card_id: string }[];
  doubts: { q: string; a: string }[];
  /** Adaptive: what to show first for this learner, and why. Never repeats a mode that just failed. */
  suggested_mode: ExplainMode;
  mode_reason: string;
};

/** Worked steps after a wrong answer. The learner picks where they went off track; then the rules say where the answer did. */
/** A careless-working habit seen on at least two different questions. Never affects mastery. */
export type Habit = { code: "HALF" | "ROOT" | "SQUARE" | "SIGN" | "UNIT" | "ARITH"; label: string; tip: string; count: number };

export type StepCheck = {
  steps: string[];
  picked: number | null;
  traced: number | null; // step the answer traces to; null until the learner picks or asks to be shown
  traceable: boolean; // the answer does trace to one step, so "Just show me" can work
  revealed: boolean; // the tutor showed the step ("Just show me") instead of the learner picking
  analysis: { step: number; code: string | null; lines: string[] } | null;
  review: StepReview | null;
};

/** What kind of mistake the picked step points to. Rules decide; Claude may only explain. */
export type StepReview = {
  step: number;
  kind: "conceptual" | "calculation";
  code: string | null;
  idea: string | null;
  card_id: string | null;
  habit: { code: Habit["code"]; label: string; tip: string } | null;
  explanation: string | null;
  engine: "rules" | "rules+claude";
  working: string | null;
  needs_detail: boolean;
  question: string | null;
  practice_item_id: string | null;
};

/* ---------------- questions & diagnosis ---------------- */

type ItemBase = { item_id: string; concept: string; stem: string; transfer: boolean };
export type McqItem = ItemBase & {
  kind: "mcq";
  options: Record<"A" | "B" | "C" | "D", string>;
  reasons: Record<"r1" | "r2" | "r3", string>;
};
export type ShortItem = ItemBase & { kind: "short" };
export type PublicItem = McqItem | ShortItem; // never contains answer keys

export type AnswerBody = {
  learner_id: string;
  item_id: string;
  confidence?: Confidence; // required for mcq, optional for short
  option?: string; // mcq
  reason_id?: string; // mcq
  reason_text?: string; // mcq "explain in my own words"
  answer_text?: string; // short (typed or voice transcript)
};

export type FollowUp = {
  kind: "question" | "sibling" | "transfer" | "card" | "clarify";
  prompt: string; // what the tutor asks/says next
  item_id: string | null; // load with getItem() when set
  card_id: string | null;
};

/** One stage of the 3-agent diagnosis pipeline, for "Why this diagnosis?". */
export type PipelineStage = {
  stage: "evaluate" | "diagnose" | "visualize";
  agent: "Evaluator" | "Diagnoser" | "Visual corrector";
  engine: "rules" | "claude" | "rules+claude" | "physics";
  outcome: string;
  ms: number;
};

/** "Your idea vs real physics" overlay, numbers computed by tested physics code (never by the AI). */
export type VisualCorrection = {
  visual: "refraction" | "shm-oscillator" | "lens-bench";
  overlay: "angle-from-surface" | "bends-toward-normal" | "speed-max-at-extremes" | "half-lens-half-image";
  params: Record<string, number | string | null | number[][]>;
  student_label: string;
  true_label: string;
  caption: string;
};

export type Feedback = {
  response_id: number;
  category: Category;
  group: Group;
  group_label: string;
  rule_fired: string;
  rule_text: string;
  engine: "rules" | "llm"; // who produced the evidence; rules always make the final call
  evidence: string[]; // short learner-facing evidence lines
  confidence: number | null; // heuristic 0–1, NOT a calibrated probability
  your_answer: string;
  correct_answer: string | null; // null when the tutor wants the learner to reason first
  feedback_text: string; // targeted teaching response
  follow_up: FollowUp | null;
  visual_correction: VisualCorrection | null;
  step_check: StepCheck | null;
  /** Mistake tracer, for wrong numeric answers: computed wrong paths and the one(s) this number fits. Rules, not AI. */
  trace: {
    checked: number; unit: string; number: number | null;
    matched: { text: string; tags: string[] }[];
    paths: { value: number; text: string; tags: string[] }[];
  } | null;
  habit: Habit | null; // set when this answer's slip repeats a habit
  pipeline: PipelineStage[];
  misconception_code: string | null;
  misconception_status: "SUSPECTED" | "CONFIRMED" | null;
  remediation_card_id: string;
  followup_item_ids: string[];
  sibling_scheduled: boolean;
  needs_clarification: boolean;
  clarify: { probes: string[]; reasons: Record<string, string>; remaining: number } | null;
  mastery: { concept: string; p_learned: number; status: MasteryStatus };
};

export type Why = {
  response_id: number;
  item_id: string;
  category: Category;
  group: Group;
  rule_fired: string;
  rule_text: string;
  engine: "rules" | "llm";
  evidence: string[];
  pipeline: PipelineStage[];
  visual_correction: VisualCorrection | null;
  distractor_map_entry: Record<string, string> | null; // mcq only
  reason: { reason_id: string; maps_to: string } | null;
  reason_text: string | null;
  classifier_confidence: number | null;
  clarifications: number;
  misconception_status: string | null;
};

/* ---------------- mastery ---------------- */

export type MasteryStatus = "not_assessed" | "emerging" | "developing" | "demonstrated";
export const MASTERY_LABEL: Record<MasteryStatus, string> = {
  not_assessed: "Not assessed",
  emerging: "Emerging",
  developing: "Developing",
  demonstrated: "Demonstrated understanding",
};

export type ConceptMastery = {
  concept: string;
  status: MasteryStatus;
  status_reason: string; // plain-language why
  enough_evidence: boolean; // false => show "Not enough evidence yet"
  p_learned: number;
  attempts: number;
  distinct_items: number;
  transfer_correct: boolean;
  last_correct: boolean;
  mastered: boolean;
  misconceptions: Record<string, "SUSPECTED" | "CONFIRMED">;
  history: number[];
};

export type Attempt = {
  response_id: number;
  item_id: string;
  kind: "mcq" | "short";
  answer: string;
  category: Category;
  group: Group;
  misconception_code: string | null;
  confidence: number | null;
  engine: "rules" | "llm";
  transfer: boolean;
  novel: boolean; // first time this learner saw the item
  counted: boolean; // false for AMBIGUOUS / UNDIAGNOSED / PARTIAL: did not move mastery
  p_after: number | null;
  created_at: string;
};

export type ConceptHistory = ConceptMastery & { reasons: string[]; attempts: Attempt[] };

/* ---------------- assessment & report ---------------- */

export type AssessmentKind = "pre" | "post";
/** Revision sheet for one topic (GET /topics/{id}/summary). */
export type TopicSummary = {
  topic_id: TopicId;
  concepts: {
    concept_id: string; name: string; definition: string; summary: string; visual: string | null; reviewed: boolean;
    equations: { expr: string; meaning: string; vars: Record<string, string>; assumptions: string }[];
    mistakes: { code: string; wrong_idea: string; why_wrong: string; correct_idea: string }[];
    doubts: { q: string; a: string }[];
  }[];
};

/** Tests are per topic; "ALL" is the combined form from before topic tests. */
export type TestTopic = "ALL" | "SHM" | "OPTICS";

export type AssessmentSession = {
  session_id: number;
  kind: AssessmentKind;
  items: PublicItem[]; // same fixed set for pre and post
  answered: string[]; // item_ids already answered (resume support)
  total: number;
  completed: boolean;
};
export type AssessmentResult = { session_id: number; kind: AssessmentKind; correct: number; total: number; score_percentage: number };

export type Report = {
  include_demo: boolean;
  questions: number;
  learners_started_pre: number;
  learners_completed_pre: number;
  learners_completed_both: number; // the matched sample, n
  pre_mean: number | null; // % over matched learners
  post_mean: number | null;
  change_pp: number | null; // percentage points, post − pre
  per_concept: { concept: string; n: number; pre: number; post: number; change_pp: number }[];
  missing: { learner: string; reason: string }[]; // anonymised labels
  limitations: string[];
};

export type LearnerReport = {
  pre: AssessmentResult | null;
  post: AssessmentResult | null;
  change_pp: number | null;
  concepts: ConceptMastery[];
  repeated_misconceptions: { code: string; description: string; count: number; concept: string }[];
  recent: Attempt[];
  revision_path: Recommendation[];
};

/* ---------------- recommendations, doubts, tutor ---------------- */

export type Recommendation = {
  kind: "misconception" | "revise" | "prerequisite" | "practice" | "improving" | "next";
  concept: string;
  title: string;
  reason: string; // always explain why
  card_id: string | null;
  item_id: string | null;
};
export type Recommendations = { next_lesson: { concept: string; reason: string } | null; items: Recommendation[] };

export type Doubt = { id: string; concept: string; q: string; a: string };
export type Doubts = {
  curated: true;
  note: string; // "Curated examples written by the team, not measured trends."
  doubts: Doubt[];
  trends: { concept: string; code: string; description: string; learners: number }[] | null; // null until enough data
};

export type TutorAnswer = { answer: string; grounded_in: string[]; engine: "llm" | "rules"; refer_teacher: boolean };

/* ---------------- Socratic dialogue & teacher map ---------------- */

export type DialogueTurn =
  | { role: "peer"; text: string; engine: "rules" | "claude" }
  | {
      role: "student";
      text: string;
      engine: "rules" | "llm";
      group: Group;
      group_label: string;
      flagged_code: string | null;
      flagged_description: string | null;
      evidence: string[];
      pipeline: PipelineStage[];
    };

export type Dialogue = {
  dialogue_id: number;
  concept: string;
  peer_name: string;
  peer_belief: string;
  code: string;
  question: string;
  status: "open" | "resolved" | "unresolved";
  turns_left: number;
  engine_note: string;
  turns: DialogueTurn[];
};

export type TeacherFlag = {
  code: string;
  concept: string;
  description: string;
  status: "suspected" | "confirmed" | "resolved";
  times: number;
  quote: string;
  source: "practice" | "dialogue";
  when: string;
};

/** Full content with answer keys: teacher review only (reviewer token). */
export type ReviewItem = {
  item_id: string; concept: string; kind: "mcq" | "short"; is_assessment: boolean; transfer: boolean; stem: string;
  options: Record<string, string> | null; correct: string | null; distractor_map: Record<string, string> | null;
  reasons: Record<string, { text: string; maps_to: string }> | null;
  answer_key: string; expected_reasoning: string; patterns: { code: string; any: string[] }[];
  calc: string; verify_flags: string[];
};
export type ReviewData = {
  concepts: (Concept & { verify_items: number })[];
  items: ReviewItem[];
  misconceptions: { code: string; concept: string; description: string; remediation_card_id: string; verify_flags: string[] }[];
};

export type ClassMap = {
  concepts: { concept: string; name: string; misconceptions: { code: string; description: string; active: number; resolved: number }[] }[];
  students: { label: string; is_demo: boolean; flags: TeacherFlag[] }[];
  steps: TeacherSteps;
  note: string;
};

/** Step picks (self-report) vs the step each answer traces to. Demo learners only when include_demo. */
export type StepPickRow = { item_id: string; picked: number; traced: number | null; code: string | null; verdict: "match" | "mismatch" | "no_trace" };
export type TeacherSteps = {
  include_demo: boolean;
  self_check: { n: number; matches: number; accuracy: number | null; preliminary: boolean };
  questions: { item_id: string; n: number; n_traced: number; picked: { step: number; count: number } | null; traced: { step: number; count: number } | null }[];
  students: { label: string; is_demo: boolean; picks: StepPickRow[] }[];
  note: string;
};

/* ---------------- modes, learners, voice ---------------- */

export type Modes = {
  llm: { live: boolean; model: string | null; note: string };
  voice: { live: boolean; note: string };
};
export type Learner = { learner_id: string; display_name: string; is_demo: boolean };
export type VoiceSession = { available: boolean; signed_url: string | null; reason: string | null };

/* ---------------- client ---------------- */

export class ApiError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Can't reach the LearnLoop server. Start it with: uvicorn api.main:app");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(typeof body?.detail === "string" ? body.detail : `Server answered ${res.status}.`, res.status);
  }
  return res.json() as Promise<T>;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]);
  return s.toString() ? `?${s}` : "";
};

export const api = {
  modes: () => call<Modes>("/modes"),
  // learners
  createLearner: () => call<Learner>("/learners", post({})),
  demoLearners: () => call<Learner[]>("/learners/demo"),
  resetDemo: (learner_id: string) => call<{ cleared: number }>("/demo/reset", post({ learner_id })),
  // curriculum
  topics: () => call<Topic[]>("/topics"),
  topicSummary: (topic: TopicId) => call<TopicSummary>(`/topics/${topic}/summary`),
  concepts: () => call<Concept[]>("/concepts"),
  lesson: (conceptId: string, learnerId?: string) =>
    call<Lesson>(`/concepts/${conceptId}/lesson${q({ learner_id: learnerId })}`),
  card: (cardId: string) => call<ConceptCard | RemediationCard>(`/explain/${encodeURIComponent(cardId)}`),
  // practice & diagnosis
  nextItem: (learnerId: string, concept?: string, kind?: "mcq" | "short") =>
    call<{ item: PublicItem | null }>(`/items/next${q({ learner_id: learnerId, concept, kind })}`),
  getItem: (itemId: string) => call<PublicItem>(`/items/${itemId}`),
  respond: (body: AnswerBody) => call<Feedback>("/responses", post(body)),
  clarify: (body: { response_id: number; reason_id?: string; text?: string }) => call<Feedback>("/clarify", post(body)),
  habits: (learnerId: string) => call<{ learner_id: string; habits: Habit[] }>(`/habits/${encodeURIComponent(learnerId)}`),
  revealStep: (responseId: number) => call<Feedback>(`/responses/${responseId}/reveal`, post({})),
  pickStep: (responseId: number, step: number, working?: string) =>
    call<Feedback>(`/responses/${responseId}/step`, post({ step, ...(working ? { working } : {}) })),
  why: (responseId: number) => call<Why>(`/diagnosis/${responseId}/why`),
  // mastery
  mastery: (learnerId: string) => call<{ learner_id: string; concepts: ConceptMastery[] }>(`/mastery/${encodeURIComponent(learnerId)}`),
  history: (learnerId: string, conceptId: string) =>
    call<ConceptHistory>(`/mastery/${encodeURIComponent(learnerId)}/${conceptId}/history`),
  // assessment & report
  startAssessment: (learner_id: string, kind: AssessmentKind, topic: TestTopic = "ALL") =>
    call<AssessmentSession>("/assessments", post({ learner_id, kind, topic })),
  answerAssessment: (sessionId: number, body: Omit<AnswerBody, "learner_id">) =>
    call<{ answered: number; total: number }>(`/assessments/${sessionId}/answers`, post(body)),
  completeAssessment: (sessionId: number) => call<AssessmentResult>(`/assessments/${sessionId}/complete`, post({})),
  report: (includeDemo = false, topic: TestTopic = "ALL") =>
    call<Report>(`/report${q({ include_demo: includeDemo ? "true" : undefined, topic: topic === "ALL" ? undefined : topic })}`),
  learnerReport: (learnerId: string, topic: TestTopic = "ALL") =>
    call<LearnerReport>(`/report/learner/${encodeURIComponent(learnerId)}${q({ topic: topic === "ALL" ? undefined : topic })}`),
  // self-learning
  recommendations: (learnerId: string) => call<Recommendations>(`/recommendations/${encodeURIComponent(learnerId)}`),
  doubts: (query?: string, concept?: string) => call<Doubts>(`/doubts${q({ q: query, concept })}`),
  ask: (body: { learner_id: string; concept: string; question: string; visual?: string }) => call<TutorAnswer>("/tutor/ask", post(body)),
  // voice (used by the VoiceTutor component)
  voiceSession: (learnerId: string, concept?: string) =>
    call<VoiceSession>(`/voice/session${q({ learner_id: learnerId, concept })}`),
  // teacher review (needs the reviewer token from api/.env)
  review: (token: string) => call<ReviewData>("/review", { headers: { "X-Reviewer-Token": token } }),
  teacherMap: (token: string, includeDemo = false) =>
    call<ClassMap>(`/teacher/map${q({ include_demo: includeDemo ? "true" : undefined })}`, { headers: { "X-Reviewer-Token": token } }),
  // Socratic dialogue with a confused peer
  startDialogue: (body: { learner_id: string; concept: string; code?: string }) => call<Dialogue>("/dialogues", post(body)),
  dialogue: (id: number) => call<Dialogue>(`/dialogues/${id}`),
  replyDialogue: (id: number, text: string) => call<Dialogue>(`/dialogues/${id}/turns`, post({ text })),
};
