import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorNote, Loading, btnPrimary } from "../components/ui";
import { api, type Concept, type ConceptMastery } from "../lib/api";
import { ZONES, ZONE_COLOR, glow, pct } from "../lib/meta";
import { VIEW, nodePoints, segment, toPercent } from "../lib/path";
import { useLearner } from "../learner";

type Node = Concept & { m: ConceptMastery | undefined; confirmed: boolean };

export default function Path() {
  const { learner, name } = useLearner();
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    setNodes(null);
    Promise.all([api.concepts(), api.mastery(learner)])
      .then(([concepts, mastery]) => {
        if (!live) return;
        const byId = new Map(mastery.concepts.map((m) => [m.concept, m]));
        setNodes(
          concepts.map((c) => {
            const m = byId.get(c.concept_id);
            return { ...c, m, confirmed: Object.values(m?.misconceptions ?? {}).includes("CONFIRMED") };
          }),
        );
      })
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [learner]);

  if (error) return <ErrorNote error={error} />;
  if (!nodes) return <Loading what="your path" />;

  const mastered = nodes.filter((n) => n.m?.mastered).length;
  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold sm:text-4xl">{name}'s path</h1>
          <p className="mt-2 text-muted">
            From a swinging pendulum to the bright and dark bands of a double slit, one idea at a time. Each point glows brighter
            as WaveLoop becomes surer you've learned it.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted">
            <span className="num text-text">{mastered}</span> of <span className="num">9</span> mastered
          </p>
          <Link to="/practice" className={btnPrimary}>Continue practising</Link>
        </div>
      </div>

      <WavePath nodes={nodes} />

      <ol className="mt-6 grid gap-2 sm:hidden">
        {nodes.map((n) => (
          <li key={n.concept_id}>
            <Link to={`/learn/${n.concept_id}`} className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-3">
              <span>
                <span className="num mr-2 text-muted">{n.concept_id}</span>
                {n.name}
              </span>
              <span className="num text-sm" style={{ color: n.confirmed ? "var(--coral)" : ZONE_COLOR[n.zone] }}>
                {pct(n.m?.p_learned ?? 0.25)}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <Legend />
    </div>
  );
}

function WavePath({ nodes }: { nodes: Node[] }) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const pts = nodePoints(nodes.length);
  const color = (i: number) => ZONE_COLOR[nodes[i].zone];
  const isRays = (i: number) => nodes[i].zone === "Rays";

  // Zone captions sit centred under the run of nodes that belong to each zone.
  const zoneSpans = ZONES.map((z) => {
    const idx = nodes.flatMap((n, i) => (n.zone === z ? [i] : []));
    return { z, x: (pts[idx[0]].x + pts[idx[idx.length - 1]].x) / 2 };
  });

  return (
    <div className="grid-paper relative mt-8 rounded-3xl border border-line bg-panel/40 px-2 pb-10 pt-4">
      <div className="relative" style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}` }}>
        <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            {pts.slice(0, -1).map((a, i) => (
              <linearGradient key={i} id={`seg${i}`} gradientUnits="userSpaceOnUse" x1={a.x} x2={pts[i + 1].x} y1="0" y2="0">
                <stop offset="0" stopColor={color(i)} />
                <stop offset="1" stopColor={color(i + 1)} />
              </linearGradient>
            ))}
          </defs>
          <line x1="8" x2={pts[0].x} y1={pts[0].y} y2={pts[0].y} stroke={color(0)} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="2 6" />
          <line x1={pts[pts.length - 1].x} x2={VIEW.w - 8} y1={pts[pts.length - 1].y} y2={pts[pts.length - 1].y}
            stroke={color(pts.length - 1)} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="2 6" />
          {pts.slice(0, -1).map((a, i) => (
            <motion.path
              key={i}
              d={segment(a, pts[i + 1], isRays(i) && isRays(i + 1))}
              fill="none"
              stroke={`url(#seg${i})`}
              strokeWidth="3"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.28, delay: 0.1 + i * 0.22, ease: "easeInOut" }}
            />
          ))}
        </svg>

        {nodes.map((n, i) => (
          <PathNode key={n.concept_id} node={n} at={toPercent(pts[i])} crest={pts[i].y < VIEW.h / 2}
            delay={reduce ? 0 : 0.1 + i * 0.22} onOpen={() => navigate(`/learn/${n.concept_id}`)} />
        ))}
      </div>

      <div className="relative mt-2 hidden h-5 sm:block">
        {zoneSpans.map(({ z, x }) => (
          <span key={z} className="absolute -translate-x-1/2 whitespace-nowrap text-sm" style={{ left: `${(x / VIEW.w) * 100}%`, color: ZONE_COLOR[z] }}>
            {z}
          </span>
        ))}
      </div>
    </div>
  );
}

function PathNode({ node, at, crest, delay, onOpen }: {
  node: Node; at: { left: string; top: string }; crest: boolean; delay: number; onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const p = node.m?.p_learned ?? 0.25;
  const c = ZONE_COLOR[node.zone];
  const g = glow(p);
  const label = `${node.concept_id} ${node.name}. Learned ${pct(p)}${node.m?.mastered ? ", mastered" : ""}${
    node.confirmed ? ", has a confirmed misconception" : ""}`;

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={at}>
      <motion.button
        onClick={onOpen}
        aria-label={label}
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay, duration: 0.25 }}
        whileHover={{ scale: 1.08 }}
        className="relative grid size-9 place-items-center rounded-full border-2 sm:size-12"
        style={{
          borderColor: c,
          background: node.m?.mastered ? c : "var(--panel)",
          boxShadow: `0 0 ${g.blur}px ${c}${Math.round(g.alpha * 255).toString(16).padStart(2, "0")}`,
        }}
      >
        {node.confirmed && (
          <motion.span
            aria-hidden="true"
            className="absolute -inset-1.5 rounded-full border-2 border-coral"
            animate={reduce ? undefined : { scale: [1, 1.35], opacity: [0.9, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span className="num text-[11px] font-semibold sm:text-xs" style={{ color: node.m?.mastered ? "var(--bg)" : c }}>
          {node.concept_id}
        </span>
      </motion.button>

      <div
        className={`pointer-events-none absolute left-1/2 hidden w-36 -translate-x-1/2 text-center sm:block ${
          crest ? "bottom-full mb-3" : "top-full mt-3"
        }`}
      >
        <p className="text-[13px] leading-snug text-text">{node.name}</p>
        <p className="num mt-0.5 text-xs" style={{ color: node.confirmed ? "var(--coral)" : "var(--muted)" }}>
          {pct(p)}
        </p>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
      <span className="flex items-center gap-2">
        <span className="size-3 rounded-full border-2 border-teal" style={{ boxShadow: "0 0 10px #2ec4b6aa" }} />
        Brighter glow: more likely learned
      </span>
      <span className="flex items-center gap-2">
        <span className="size-3 rounded-full bg-amber" />
        Filled: mastered
      </span>
      <span className="flex items-center gap-2">
        <span className="size-3 rounded-full border-2 border-coral" />
        Coral ring: a wrong idea showed up twice
      </span>
    </div>
  );
}
