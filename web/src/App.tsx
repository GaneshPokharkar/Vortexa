import { AudioLines, ChevronDown, Cpu, FlaskConical, LogOut, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, type Learner } from "./lib/api";
import { learnerName, useLearner } from "./lib/learner";
import { lazy, Suspense } from "react";
import Assessment from "./screens/Assessment";
import Doubts from "./screens/Doubts";
import Home from "./screens/Home";
import Landing from "./screens/Landing";
import Report from "./screens/Report";
import Learn from "./screens/Learn";
import Teacher from "./screens/Teacher";
import Topics from "./screens/Topics";

const DevOverlays = import.meta.env.DEV ? lazy(() => import("./screens/DevOverlays")) : null;

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-md" aria-label="LearnLoop AI home">
      <svg width="30" height="20" viewBox="0 0 30 20" aria-hidden="true">
        <path d="M3 10c0-4 3-7 6.5-7S15 6 15 10s2.5 7 6 7 6-3 6-7-3-7-6.5-7" fill="none" stroke="var(--ll-blue)"
          strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="15" cy="10" r="2.2" fill="var(--ll-ink)" />
      </svg>
      <span className="whitespace-nowrap text-[18px] font-semibold tracking-tight text-ink">
        LearnLoop <span className="font-normal text-muted">AI</span>
      </span>
    </Link>
  );
}

const NAV = [
  { to: "/home", label: "Home" },
  { to: "/topics", label: "Learn" },
  { to: "/assessment", label: "Tests" },
  { to: "/report", label: "Report" },
  { to: "/doubts", label: "Doubts" },
];

function ModeBadges() {
  const { modes } = useLearner();
  if (!modes) return null;
  return (
    <div className="hidden items-center gap-1.5 xl:flex">
      <span
        title={modes.llm.note}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] ${
          modes.llm.live ? "bg-blue-soft text-blue-ink" : "bg-surface-2 text-muted"
        }`}
      >
        <Cpu className="size-3.5" aria-hidden="true" />
        {modes.llm.live ? "Claude on" : "Demo engine"}
      </span>
      <span
        title={modes.voice.note}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] ${
          modes.voice.live ? "bg-blue-soft text-blue-ink" : "bg-surface-2 text-muted"
        }`}
      >
        <AudioLines className="size-3.5" aria-hidden="true" />
        {modes.voice.live ? "Voice on" : "Voice off"}
      </span>
    </div>
  );
}

function LearnerMenu() {
  const { learner, useDemo, leave } = useLearner();
  const [open, setOpen] = useState(false);
  const [demos, setDemos] = useState<Learner[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && !demos.length) api.demoLearners().then(setDemos).catch(() => setDemos([]));
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open, demos.length]);

  if (!learner) return null;
  const clear = async () => {
    const r = await api.resetDemo(learner.learner_id);
    setNote(`Cleared ${r.cleared} answers for ${learner.display_name}.`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-[14px] text-ink hover:border-line-strong"
      >
        <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-ink-2">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <span className="sr-only sm:not-sr-only">{learnerName(learner)}</span>
        {learner.is_demo && <span className="rounded bg-gc-soft px-1.5 text-[11.5px] font-medium text-gc">Demo</span>}
        <ChevronDown className="size-3.5 text-muted" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-line bg-surface p-2 shadow-[0_8px_30px_rgb(14_42_71/0.10)]">
          <p className="px-2.5 pb-1 pt-1.5 text-[12.5px] text-muted">Demo learners (not real students)</p>
          {demos.map((d) => (
            <button key={d.learner_id} role="menuitem" onClick={() => { useDemo(d); setNote(null); setOpen(false); navigate("/home"); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] hover:bg-surface-2 ${
                d.learner_id === learner.learner_id ? "font-medium text-blue-ink" : "text-ink"}`}>
              <FlaskConical className="size-4 text-muted" aria-hidden="true" /> {d.display_name}
            </button>
          ))}
          {learner.is_demo && (
            <button role="menuitem" onClick={clear}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] text-ink hover:bg-surface-2">
              <Trash2 className="size-4 text-muted" aria-hidden="true" /> Clear this demo learner's answers
            </button>
          )}
          {note && <p className="px-2.5 py-1.5 text-[12.5px] text-ga" role="status">{note}</p>}
          <div className="my-1 border-t border-line" />
          <button role="menuitem" onClick={() => { leave(); setOpen(false); navigate("/"); }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] text-ink hover:bg-surface-2">
            <LogOut className="size-4 text-muted" aria-hidden="true" /> Leave this device's session
          </button>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { learner } = useLearner();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-6 sm:px-6 sm:py-0">
          <Wordmark />
          {learner && (
            <nav aria-label="Main" className="order-last -mx-1 flex min-w-0 basis-full gap-0.5 overflow-x-auto [scrollbar-width:none] sm:order-none sm:flex-1 sm:basis-auto">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to}
                  className={({ isActive }) => `whitespace-nowrap rounded-md px-2 py-1.5 text-[14.5px] sm:px-2.5 transition-colors ${
                    isActive ? "bg-blue-soft font-medium text-blue-ink" : "text-ink-2 hover:bg-surface-2"}`}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-3">
            <ModeBadges />
            <LearnerMenu />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-[14px] text-muted sm:px-6">
          <p>LearnLoop supports your teacher. It does not replace them.</p>
          <div className="flex gap-4">
            <Link to="/teacher" className="hover:text-ink">For teachers</Link>
            <span>Content is a draft awaiting teacher review.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NeedsLearner({ children }: { children: ReactNode }) {
  const { learner } = useLearner();
  return learner ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/home" element={<NeedsLearner><Home /></NeedsLearner>} />
        <Route path="/topics" element={<NeedsLearner><Topics /></NeedsLearner>} />
        <Route path="/learn/:conceptId" element={<NeedsLearner><Learn /></NeedsLearner>} />
        <Route path="/assessment" element={<NeedsLearner><Assessment /></NeedsLearner>} />
        <Route path="/report" element={<NeedsLearner><Report /></NeedsLearner>} />
        <Route path="/doubts" element={<Doubts />} />
        <Route path="/teacher" element={<Teacher />} />
        <Route path="/review" element={<Navigate to="/teacher" replace />} />
        {DevOverlays && <Route path="/dev/overlays" element={<Suspense fallback={null}><DevOverlays /></Suspense>} />}
        <Route path="*" element={<p className="py-16 text-muted">This page doesn't exist. <Link className="text-blue-ink underline" to="/">Go to the start</Link>.</p>} />
      </Routes>
    </Shell>
  );
}
