import { ArrowRight, ClipboardCheck, LineChart, MessageCircleQuestion, PlayCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useParams } from "react-router-dom";
import { ConceptTile, ErrorNote, Loading, Stars } from "../../components/ui";
import { api, type Concept, type ConceptMastery, type Topic, type TopicId } from "../../lib/api";
import { STATUS, forYou } from "../../lib/groups";
import { useLearner } from "../../lib/learner";

type TopicCtx = {
  learnerId: string; topic: Topic; concepts: Concept[]; mastery: Map<string, ConceptMastery>; refresh: () => void;
};
const Ctx = createContext<TopicCtx | null>(null);
export const useTopic = () => useContext(Ctx)!;

export const TOPIC_ICON: Record<TopicId, string> = { SHM: "C1", OPTICS: "C7" };

export const OPTIONS = [
  { to: "learn", label: "Learn Visually", icon: PlayCircle,
    desc: "Understand concepts through animations, diagrams, examples and step-by-step explanations." },
  { to: "doubt", label: "Solve My Doubt", icon: MessageCircleQuestion,
    desc: "Ask a Physics question and get an explanation that finds where your understanding may be going wrong." },
  { to: "test", label: "Test My Understanding", icon: ClipboardCheck,
    desc: "Answer questions, discover misconceptions and measure your understanding." },
  { to: "summary", label: "Summary & My Progress", icon: LineChart,
    desc: "Review important formulas, revisit common mistakes and see which concepts you have understood." },
] as const;

/** Stars + label for one concept, from evidence only. */
export function ConceptStars({ m, size = "sm" }: { m: ConceptMastery | undefined; size?: "sm" | "md" }) {
  const step = m && m.enough_evidence ? STATUS[m.status].step : 0;
  const label = !m || !m.attempts ? "Not started" : m.enough_evidence ? STATUS[m.status].label : "Keep practising";
  return <Stars size={size} step={step} label={label} />;
}

/** Workspace for one topic: header, the four options, and the selected option below. */
export default function TopicLayout() {
  const { topicId } = useParams();
  const { learner } = useLearner();
  const learnerId = learner!.learner_id;
  const [data, setData] = useState<{ topic: Topic; concepts: Concept[] } | null | "missing">(null);
  const [mastery, setMastery] = useState<Map<string, ConceptMastery>>(new Map());
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(() => {
    api.mastery(learnerId).then((m) => setMastery(new Map(m.concepts.map((c) => [c.concept, c])))).catch(() => {});
  }, [learnerId]);

  useEffect(() => {
    setData(null);
    Promise.all([api.topics(), api.concepts()]).then(([ts, cs]) => {
      const topic = ts.find((t) => t.topic_id === topicId);
      setData(topic ? { topic, concepts: cs.filter((c) => c.topic_id === topic.topic_id) } : "missing");
    }).catch(setError);
    refresh();
  }, [topicId, refresh]);

  if (error) return <div className="pt-10"><ErrorNote error={error} /></div>;
  if (data === "missing") return <Navigate to="/home" replace />;
  if (!data) return <Loading what="the topic" />;

  return (
    <Ctx.Provider value={{ learnerId, topic: data.topic, concepts: data.concepts, mastery, refresh }}>
      <div className="pb-10 pt-6">
        <p className="text-[14px] text-muted"><Link to="/home" className="hover:text-ink">Home</Link> · {data.topic.title}</p>
        <div className="mt-2 flex items-center gap-3.5">
          <ConceptTile id={TOPIC_ICON[data.topic.topic_id]} size="lg" />
          <div className="min-w-0">
            <h1 className="text-[28px] font-extrabold leading-tight sm:text-[34px]">
              <Link to={`/topic/${data.topic.topic_id}`} className="hover:text-blue-ink">{data.topic.title}</Link>
            </h1>
            <p className="mt-0.5 text-[15px] text-muted">{data.topic.description}</p>
          </div>
        </div>

        <nav aria-label={`${data.topic.title} options`} className="mt-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 [scrollbar-width:none]">
          {OPTIONS.map((o) => (
            <NavLink key={o.to} to={o.to}
              className={({ isActive }) => `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[14.5px] font-bold transition-colors ${
                isActive ? "bg-blue text-white" : "text-ink-2 hover:bg-surface-2"}`}>
              <o.icon className="size-4" aria-hidden="true" /> {o.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6"><Outlet /></div>
      </div>
    </Ctx.Provider>
  );
}

/** "What do you want to do?" — the four options as cards, Learn Visually first and largest. */
export function TopicOverview() {
  const { topic, concepts, mastery } = useTopic();
  const answered = concepts.reduce((n, c) => n + (mastery.get(c.concept_id)?.attempts ?? 0), 0);
  return (
    <div>
      <h2 className="text-[20px] font-extrabold">What do you want to do?</h2>
      <p className="mt-1 text-[15px] text-muted">
        {concepts.length} ideas in {topic.title}. {answered ? `You've answered ${answered} question${answered === 1 ? "" : "s"} here so far.` : "Start with Learn Visually."}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {OPTIONS.map((o, i) => (
          <Link key={o.to} to={o.to}
            className={`group flex flex-col rounded-2xl border-2 px-5 py-5 shadow-[0_2px_0_var(--ll-line)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-blue ${
              i === 0 ? "border-blue/40 bg-[linear-gradient(135deg,var(--ll-blue-soft),var(--ll-surface)_60%,var(--ll-sun-soft))] md:col-span-2 md:flex-row md:items-center md:gap-5"
                : "border-line bg-surface"}`}>
            <span className={`grid shrink-0 place-items-center rounded-2xl ${i === 0 ? "size-16 bg-blue text-white" : "size-12 bg-blue-soft text-blue-ink"}`}>
              <o.icon className={i === 0 ? "size-8" : "size-6"} aria-hidden="true" />
            </span>
            <span className="mt-3 min-w-0 flex-1 md:mt-0">
              <span className="flex items-center gap-2">
                <span className="num text-[13px] font-extrabold text-muted">{String.fromCharCode(65 + i)}</span>
                <span className={`font-extrabold text-ink ${i === 0 ? "text-[22px]" : "text-[18px]"}`}>{o.label}</span>
                {i === 0 && <span className="rounded-full bg-sun-soft px-2 py-0.5 text-[12px] font-bold text-[#9a5b00]">Start here</span>}
              </span>
              <span className="mt-1 block text-[15px] text-ink-2">{o.desc}</span>
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-bold text-blue-ink md:mt-0">
              Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Learn Visually: pick an idea. */
export function LearnIndex() {
  const { topic, concepts, mastery } = useTopic();
  return (
    <div>
      <h2 className="text-[20px] font-extrabold">Pick an idea to see it in action</h2>
      <p className="mt-1 text-[15px] text-muted">Every idea opens with an interactive simulation, then the explanation, a solved example and a question to check yourself.</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {concepts.map((c, i) => (
          <li key={c.concept_id}>
            <Link to={c.concept_id}
              className="flex h-full items-start gap-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-[0_2px_0_var(--ll-line)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-blue">
              <ConceptTile id={c.concept_id} />
              <span className="min-w-0 flex-1">
                <span className="text-[13px] font-bold text-muted">Idea {i + 1} of {concepts.length} · {topic.title}</span>
                <span className="block text-[17px] font-bold text-ink">{c.name}</span>
                <span className="mt-1 block text-[14px] text-muted">{forYou(c.learning_objective)}</span>
                <span className="mt-2 block"><ConceptStars m={mastery.get(c.concept_id)} /></span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
