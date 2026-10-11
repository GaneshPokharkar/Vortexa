import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { ExplainMode, Lesson } from "../../lib/api";
import { VISUALS } from "../../visuals";
import { Speak, SpeechLang, recorded } from "../../voice/Speak";

type Mode = "simple" | "steps" | "worked" | "analogy" | "visual" | "formal";
const MODES: { id: Mode; label: string }[] = [
  { id: "simple", label: "Simple" },
  { id: "steps", label: "Step by step" },
  { id: "worked", label: "Worked example" },
  { id: "analogy", label: "Analogy" },
  { id: "visual", label: "Visual" },
  { id: "formal", label: "Formal" },
];

/** The server's suggestion uses the brief's names; map them onto the tabs. */
const FROM_SUGGESTION: Record<ExplainMode, Mode> = {
  beginner: "simple", steps: "steps", worked: "worked", analogy: "analogy", visual: "visual", practice: "simple",
};

export function LessonPanel({ lesson }: { lesson: Lesson }) {
  const card = lesson.card;
  const hasVisual = Boolean(card.visual && VISUALS[card.visual]);
  const suggested = FROM_SUGGESTION[lesson.suggested_mode];
  const [mode, setMode] = useState<Mode>(suggested === "visual" && !hasVisual ? "simple" : suggested);
  const [alt, setAlt] = useState(-1); // -1: main explanation; 0..n: alternative explanations

  useEffect(() => {
    setMode(suggested === "visual" && !hasVisual ? "simple" : suggested);
    setAlt(-1);
  }, [lesson.concept.concept_id, suggested, hasVisual]);

  const Visual = hasVisual ? VISUALS[card.visual] : null;
  const modes = MODES.filter((m) => m.id !== "visual" || hasVisual);
  const spoken = alt < 0 ? recorded(`lesson-${card.concept}`, card.simple) : null; // only the main explanation is recorded

  return (
    <section aria-label="Lesson" className="overflow-hidden rounded-xl border border-line bg-surface">
      <div role="tablist" aria-label="Explanation style" className="flex flex-wrap gap-1 border-b border-line px-3 py-2.5">
        {modes.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => { setMode(m.id); setAlt(-1); }}
            className={`rounded-lg px-3 py-1.5 text-[14px] transition-colors ${
              mode === m.id ? "bg-blue-soft font-medium text-blue-ink" : "text-ink-2 hover:bg-surface-2"}`}>
            {m.label}
          </button>
        ))}
      </div>
      {lesson.suggested_mode !== "beginner" && (
        <p className="bg-surface-2 px-5 py-2.5 text-[13.5px] text-muted">
          Suggested for you: {modes.find((m) => m.id === suggested)?.label ?? "Practice"}. {lesson.mode_reason}
        </p>
      )}

      <div role="tabpanel" className="px-5 py-5 sm:px-6">
        {mode === "simple" && <p className="read text-[18.5px] text-ink">{alt < 0 ? card.simple || card.statement : card.alternatives[alt]}</p>}
        {mode === "formal" && <p className="read text-[17px] text-ink">{card.formal}</p>}
        {mode === "analogy" && <p className="read text-[18px] text-ink">{card.analogy}</p>}
        {mode === "worked" && <p className="read rounded-lg border-l-2 border-blue bg-bg px-4 py-3 text-[17px] text-ink">{card.worked_example}</p>}
        {mode === "steps" && (
          <ol className="space-y-3">
            {card.steps.map((s, i) => (
              <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <span className="num mt-0.5 grid size-6 place-items-center rounded-full bg-blue-soft text-[13px] font-semibold text-blue-ink">{i + 1}</span>
                <span className="read text-[17px] text-ink">{s}</span>
              </li>
            ))}
          </ol>
        )}
        {mode === "visual" && Visual && <Visual />}

        {mode === "simple" && (spoken || card.alternatives.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
            {spoken && (
              <>
                <Speak id={spoken} />
                <SpeechLang />
              </>
            )}
            {card.alternatives.length > 0 && (
              <button onClick={() => setAlt((a) => (a + 1 >= card.alternatives.length ? -1 : a + 1))}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[14.5px] text-blue-ink hover:bg-surface-2">
                <RefreshCcw className="size-4" aria-hidden="true" />
                {alt + 1 >= card.alternatives.length ? "Back to the first explanation" : "Explain it another way"}
              </button>
            )}
          </div>
        )}
      </div>

      {card.equations.length > 0 && (
        <div className="border-t border-line px-5 py-5 sm:px-6">
          <h2 className="text-[15px] font-semibold">Equations</h2>
          <dl className="mt-3 space-y-3">
            {card.equations.map((e) => (
              <div key={e.expr} className="grid gap-x-5 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)]">
                <dt className="math text-[18px] text-ink">{e.expr}</dt>
                <dd className="m-0 text-[14px] text-muted">
                  {Object.entries(e.vars).map(([k, v]) => <span key={k} className="mr-3 inline-block"><span className="math text-ink-2">{k}</span> {v}</span>)}
                  {e.assumptions && <span className="block text-[13px]">Assumes: {e.assumptions}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted sm:px-6">
        Source: card <span className="num">{card.card_id}</span> ·{" "}
        {card.verify_flags.length ? "draft, awaiting teacher review" : "reviewed by a teacher"}
      </p>
    </section>
  );
}
