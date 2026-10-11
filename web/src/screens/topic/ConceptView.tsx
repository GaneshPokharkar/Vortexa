import { ArrowLeft, ArrowRight, BookOpen, Eye, FileCheck2, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Films, FILMS_FOR_CONCEPT } from "../../components/Films";
import { AskChat } from "../../components/learn/AskChat";
import { LessonPanel } from "../../components/learn/LessonPanel";
import { PracticePanel } from "../../components/learn/PracticePanel";
import { Button, ConceptTile, ErrorNote, Loading, Panel } from "../../components/ui";
import { api, type Lesson } from "../../lib/api";
import { forYou } from "../../lib/groups";
import { VISUALS } from "../../visuals";
import { Speak, SpeechLang, recorded } from "../../voice/Speak";
import { ConceptStars, useTopic } from "./TopicLayout";

type Section = "see" | "understand" | "example" | "practice";
const SECTIONS: { id: Section; label: string; icon: typeof Eye }[] = [
  { id: "see", label: "See it", icon: Eye },
  { id: "understand", label: "Understand it", icon: BookOpen },
  { id: "example", label: "Solved example", icon: FileCheck2 },
  { id: "practice", label: "Check yourself", icon: PenLine },
];

/** One idea, visual first: simulation → explanation → solved example → a question with diagnosis. */
export default function ConceptView() {
  const { conceptId = "" } = useParams();
  const [params] = useSearchParams();
  const { learnerId, concepts, mastery, refresh } = useTopic();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [section, setSection] = useState<Section>("see");
  const [fromPractice, setFromPractice] = useState(false);

  useEffect(() => {
    setLesson(null);
    setError(null);
    setFromPractice(false);
    api.lesson(conceptId, learnerId).then((l) => {
      setLesson(l);
      const asked = params.get("s") as Section | null;
      const suggested: Record<string, Section> = { practice: "practice", worked: "example", steps: "understand", analogy: "understand" };
      setSection(asked && SECTIONS.some((s) => s.id === asked) ? asked : suggested[l.suggested_mode] ?? "see");
    }).catch(setError);
  }, [conceptId, learnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!concepts.some((c) => c.concept_id === conceptId)) return <ErrorNote error={new Error("unknown")} />;
  if (error) return <ErrorNote error={error} />;
  if (!lesson) return <Loading what="the lesson" />;

  const card = lesson.card;
  const Visual = card.visual ? VISUALS[card.visual] : undefined;
  const spoken = recorded(`lesson-${card.concept}`, card.simple);
  const index = concepts.findIndex((c) => c.concept_id === conceptId);
  const go = (to: Section, fromQuestion = false) => {
    setSection(to);
    setFromPractice(fromQuestion);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const at = SECTIONS.findIndex((s) => s.id === section);
  const next = SECTIONS[at + 1];
  const nextIdea = concepts[index + 1];

  const BackToQuestion = () => fromPractice ? (
    <Button variant="secondary" className="mb-4" onClick={() => go("practice")}>
      <ArrowLeft className="size-4" aria-hidden="true" /> Back to your question
    </Button>
  ) : null;

  return (
    <div>
      <nav aria-label="Ideas in this topic" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {concepts.map((c, i) => (
          <Link key={c.concept_id} to={`../${c.concept_id}`} relative="path" aria-current={c.concept_id === conceptId ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[13.5px] font-bold ${
              c.concept_id === conceptId ? "border-blue bg-blue-soft text-blue-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
            <span className="num">{i + 1}</span> {c.name}
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <ConceptTile id={conceptId} />
        <h2 className="text-[24px] font-extrabold leading-tight">{lesson.concept.name}</h2>
        <span className="rounded-full border border-line bg-surface px-3 py-1"><ConceptStars m={mastery.get(conceptId)} /></span>
      </div>
      <p className="mt-1.5 max-w-3xl text-[15px] text-muted">{forYou(lesson.concept.learning_objective)}</p>

      <div role="tablist" aria-label="Learning steps" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SECTIONS.map((s, i) => (
          <button key={s.id} type="button" role="tab" aria-selected={section === s.id} onClick={() => go(s.id)}
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-[14.5px] font-bold transition-colors ${
              section === s.id ? "border-blue bg-blue-soft text-blue-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
            <span className={`num grid size-6 shrink-0 place-items-center rounded-full text-[12px] ${section === s.id ? "bg-blue text-white" : "bg-surface-2"}`}>{i + 1}</span>
            <s.icon className="size-4 shrink-0" aria-hidden="true" /> {s.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {section === "see" && (
          <div>
            <BackToQuestion />
            <Panel className="px-5 py-5 sm:px-6">
              {Visual ? (
                <>
                  <p className="text-[14.5px] text-muted">Drag, play and pause. Watch what changes and what stays the same.</p>
                  <div id="current-visual" className="mt-3"><Visual /></div>
                </>
              ) : <p className="text-[15px] text-muted">This idea has no simulation yet; the explanation below covers it.</p>}
              <div className="mt-5 rounded-xl border border-blue/20 bg-blue-soft/40 px-4 py-3.5">
                <h3 className="text-[15px] font-extrabold text-ink">What's happening</h3>
                <p className="read mt-1 text-[17px] text-ink">{card.simple || card.statement}</p>
                {spoken && <div className="mt-2 flex flex-wrap items-center gap-2"><Speak id={spoken} /><SpeechLang /></div>}
              </div>
              {FILMS_FOR_CONCEPT[conceptId] && (
                <div className="mt-5">
                  <h3 className="mb-2 text-[15px] font-extrabold text-ink">Watch the 1-minute film: predict, watch, explain</h3>
                  <Films only={FILMS_FOR_CONCEPT[conceptId]} />
                </div>
              )}
              {Visual && (
                <p className="mt-3 text-[13.5px] text-muted">
                  Confused by the picture? Open <b>Ask the tutor</b> (bottom right): it can see what the simulation shows right now.
                </p>
              )}
            </Panel>
          </div>
        )}

        {section === "understand" && <LessonPanel lesson={lesson} exclude={["visual", "worked"]} />}

        {section === "example" && (
          <div>
            <BackToQuestion />
            <Panel className="px-5 py-5 sm:px-6">
              <h3 className="text-[17px] font-extrabold">Solved example</h3>
              <p className="read mt-3 rounded-xl border border-blue/20 bg-blue-soft/40 px-4 py-3 text-[17px] text-ink">{card.worked_example}</p>
              {card.steps.length > 0 && (
                <>
                  <h4 className="mt-5 text-[15px] font-bold">The method, step by step</h4>
                  <ol className="mt-2 space-y-2.5">
                    {card.steps.map((s, i) => (
                      <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                        <span className="num mt-0.5 grid size-6 place-items-center rounded-full bg-blue-soft text-[13px] font-semibold text-blue-ink">{i + 1}</span>
                        <span className="read text-[16px] text-ink">{s}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </Panel>
          </div>
        )}

        <div hidden={section !== "practice"}>
          <PracticePanel learnerId={learnerId} conceptId={conceptId} onAnswered={refresh}
            startItem={params.get("q")?.startsWith(`${conceptId}-`) ? params.get("q")! : undefined}
            links={{ hasVisual: Boolean(Visual), show: (mode) => go(mode === "visual" ? "see" : "example", true) }} />
        </div>

        {!fromPractice && (
          <div className="mt-5 flex flex-wrap gap-2">
            {next ? (
              <Button onClick={() => go(next.id)}>Next: {next.label} <ArrowRight className="size-4" aria-hidden="true" /></Button>
            ) : nextIdea ? (
              <Link to={`../${nextIdea.concept_id}`} relative="path"
                className="inline-flex items-center gap-2 rounded-xl bg-blue px-4 py-2.5 text-[15px] font-bold text-white shadow-[0_3px_0_var(--ll-blue-ink)] hover:bg-blue-ink">
                Next idea: {nextIdea.name} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        )}
      </div>

      <AskChat learnerId={learnerId} conceptId={conceptId} conceptName={lesson.concept.name}
        suggestions={lesson.doubts.slice(0, 3).map((d) => d.q)} quick={["Explain it more simply", "Show me a worked example"]} />
    </div>
  );
}
