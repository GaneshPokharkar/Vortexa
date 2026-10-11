import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const TOPICS = [
  {
    id: "SHM", title: "Simple Harmonic Motion (SHM)", button: "Explore SHM", Art: SpringArt,
    text: "Understand oscillations, displacement, velocity, acceleration, time period and energy through animations, graphs and interactive examples.",
  },
  {
    id: "OPTICS", title: "Optics", button: "Explore Optics", Art: LensArt,
    text: "Understand refraction, lenses, image formation and light rays through interactive ray diagrams and visual explanations.",
  },
] as const;

/** Home: the first action is choosing a topic. Nothing else competes for attention. */
export default function Home() {
  return (
    <div className="pb-12 pt-10">
      <h1 className="text-center text-[34px] font-extrabold leading-tight sm:text-[44px]">Learn Physics Your Way</h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-[17px] text-ink-2">
        Understand difficult concepts through visual explanations, interactive learning, AI-powered doubt solving and personalized practice.
      </p>
      <div className="mt-9 grid gap-6 md:grid-cols-2">
        {TOPICS.map(({ id, title, text, button, Art }) => (
          <Link key={id} to={`/topic/${id}`}
            className="group flex flex-col overflow-hidden rounded-3xl border-2 border-line bg-surface shadow-[0_3px_0_var(--ll-line)] transition-[border-color,transform] hover:-translate-y-1 hover:border-blue">
            <div className="border-b border-line bg-[linear-gradient(160deg,var(--ll-blue-soft),var(--ll-surface))] px-6 py-6"><Art /></div>
            <div className="flex flex-1 flex-col px-6 py-6">
              <h2 className="text-[24px] font-extrabold">{title}</h2>
              <p className="mt-2 flex-1 text-[16px] text-ink-2">{text}</p>
              <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-blue px-5 py-3 text-[16px] font-bold text-white shadow-[0_3px_0_var(--ll-blue-ink)] group-hover:bg-blue-ink">
                {button} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** A block on a spring oscillating about the mean position, with the x–t sine curve below. Decorative. */
function SpringArt() {
  return (
    <svg viewBox="0 0 320 150" className="mx-auto h-36 w-full max-w-sm" role="img" aria-label="A block on a spring oscillating about its mean position, and its displacement–time sine graph">
      <line x1="20" y1="22" x2="20" y2="72" stroke="var(--ll-ink-2)" strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="74" x2="300" y2="74" stroke="var(--ll-line-strong)" strokeWidth="2" />
      <line x1="170" y1="14" x2="170" y2="80" stroke="var(--ll-blue)" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="170" y="92" textAnchor="middle" fontSize="10" fill="var(--ll-muted)">mean</text>
      <text x="120" y="92" textAnchor="middle" fontSize="10" fill="var(--ll-muted)">−A</text>
      <text x="220" y="92" textAnchor="middle" fontSize="10" fill="var(--ll-muted)">+A</text>
      <g className="shm-spring">
        <polyline fill="none" stroke="var(--ll-ink-2)" strokeWidth="2.5" strokeLinejoin="round"
          points="20,48 34,48 42,36 58,60 74,36 90,60 106,36 122,60 132,48 150,48" />
      </g>
      <g className="shm-block">
        <rect x="150" y="30" width="40" height="40" rx="6" fill="var(--ll-blue)" />
        <text x="170" y="55" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">m</text>
      </g>
      <path d="M20 125 C 45 100, 70 100, 95 125 S 145 150, 170 125 S 220 100, 245 125 S 295 150, 300 140" fill="none" stroke="var(--ll-coral)" strokeWidth="2.5" />
      <text x="300" y="118" textAnchor="end" fontSize="10" fill="var(--ll-muted)">x(t)</text>
    </svg>
  );
}

/** Convex lens, object at 2F: the three standard rays meet at an inverted image of the same size at 2F′. Decorative. */
function LensArt() {
  return (
    <svg viewBox="0 0 320 150" className="mx-auto h-36 w-full max-w-sm" role="img"
      aria-label="Ray diagram: an object at 2F in front of a convex lens forms a real, inverted image of the same size at 2F on the other side">
      <line x1="10" y1="80" x2="310" y2="80" stroke="var(--ll-line-strong)" strokeWidth="1.5" />
      <ellipse cx="160" cy="80" rx="9" ry="56" fill="var(--ll-blue-soft)" stroke="var(--ll-blue)" strokeWidth="2" />
      {[120, 200].map((x) => <circle key={x} cx={x} cy="80" r="2.8" fill="var(--ll-ink-2)" />)}
      <text x="120" y="96" textAnchor="middle" fontSize="10" fill="var(--ll-muted)">F</text>
      <text x="200" y="96" textAnchor="middle" fontSize="10" fill="var(--ll-muted)">F′</text>
      <line x1="80" y1="80" x2="80" y2="52" stroke="var(--ll-ink)" strokeWidth="3" markerEnd="url(#tip)" />
      <line x1="240" y1="80" x2="240" y2="108" stroke="var(--ll-coral)" strokeWidth="3" markerEnd="url(#tip2)" />
      <g className="ray-flow" fill="none" stroke="var(--ll-sun)" strokeWidth="2">
        <polyline points="80,50 160,50 240,110" />
        <polyline points="80,50 240,110" />
        <polyline points="80,50 160,110 240,110" />
      </g>
      <text x="80" y="44" textAnchor="middle" fontSize="10" fill="var(--ll-muted)">object</text>
      <text x="240" y="124" textAnchor="middle" fontSize="10" fill="var(--ll-muted)">image</text>
      <defs>
        <marker id="tip" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10z" fill="var(--ll-ink)" /></marker>
        <marker id="tip2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10z" fill="var(--ll-coral)" /></marker>
      </defs>
    </svg>
  );
}
