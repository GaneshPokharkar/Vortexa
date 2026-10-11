import { NavLink, Route, Routes } from "react-router-dom";
import { PERSONAS, useLearner } from "./learner";
import Learn from "./screens/Learn";
import Mastery from "./screens/Mastery";
import Path from "./screens/Path";
import Practice from "./screens/Practice";

function Wordmark() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5 rounded-md" aria-label="WaveLoop home">
      <svg width="34" height="18" viewBox="0 0 34 18" aria-hidden="true">
        <path d="M1 9 C5 1, 9 1, 13 9 S21 17, 25 9 S31 3, 33 5" fill="none" stroke="var(--teal)" strokeWidth="2.4"
          strokeLinecap="round" />
        <circle cx="13" cy="9" r="2.4" fill="var(--amber)" />
      </svg>
      <span className="font-head text-lg font-semibold tracking-tight">WaveLoop</span>
    </NavLink>
  );
}

function PersonaSwitch() {
  const { learner, setLearner } = useLearner();
  return (
    <div role="radiogroup" aria-label="Learner" className="flex rounded-full border border-line bg-panel p-1">
      {PERSONAS.map((p) => {
        const on = p.id === learner;
        return (
          <button
            key={p.id}
            role="radio"
            aria-checked={on}
            onClick={() => setLearner(p.id)}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              on ? "bg-panel-2 text-text" : "text-muted hover:text-text"
            }`}
          >
            <span
              aria-hidden="true"
              className="grid size-5 place-items-center rounded-full font-head text-[11px] font-semibold text-bg"
              style={{ background: p.id === "asha" ? "var(--amber)" : "var(--teal)" }}
            >
              {p.name[0]}
            </span>
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm transition-colors ${isActive ? "text-text" : "text-muted hover:text-text"}`;

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-panel focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Wordmark />
          <nav aria-label="Main" className="flex gap-1">
            <NavLink to="/" end className={navClass}>Path</NavLink>
            <NavLink to="/mastery" className={navClass}>Mastery</NavLink>
          </nav>
        </div>
        <PersonaSwitch />
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <Routes>
          <Route path="/" element={<Path />} />
          <Route path="/learn/:conceptId" element={<Learn />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/:conceptId" element={<Practice />} />
          <Route path="/mastery" element={<Mastery />} />
          <Route path="*" element={<p className="pt-10 text-muted">That page doesn't exist. Go back to your path.</p>} />
        </Routes>
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-muted sm:px-6">
          WaveLoop supports your teacher. It does not replace them.
        </p>
      </footer>
    </div>
  );
}
