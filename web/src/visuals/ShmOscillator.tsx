import { useEffect, useMemo, useState } from "react";
import { Callout, Frame, RangeControl, Readout } from "./controls";
import { period, state } from "./shmPhysics";
import { Arrow } from "./svgParts";
import { C, SERIES, fmt, prefersReducedMotion } from "./theme";

const MASS = 0.5; // kg
const PHI = 0; // rad, so the block starts at x = +A

// Scene geometry (SVG user units)
const W = 420;
const H = 210;
const WALL_X = 18;
const FLOOR_Y = 128;
const BLOCK = 34;
const MEAN_X = 190;
const PX_PER_M = 450; // 0.20 m -> 90 units
const ARROW_MAX = 80;
const BAR_TOP = 40;
const BAR_H = FLOOR_Y - BAR_TOP;

function springPath(x0: number, x1: number, y: number): string {
  const coils = 12;
  const lead = 6;
  const span = Math.max(1, x1 - x0 - 2 * lead);
  const pts = [`${x0},${y}`, `${x0 + lead},${y}`];
  for (let i = 0; i < coils; i++) {
    pts.push(`${x0 + lead + ((i + 0.5) / coils) * span},${y + (i % 2 === 0 ? -9 : 9)}`);
  }
  pts.push(`${x1 - lead},${y}`, `${x1},${y}`);
  return pts.join(" ");
}

export function ShmOscillator({ compact = false }: { compact?: boolean }) {
  const [A, setA] = useState(0.15);
  const [omega, setOmega] = useState(3);
  const [t, setT] = useState(0);
  // Never autoplay for users who prefer reduced motion.
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  // Animation loop runs only while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last: number | null = null;
    const step = (now: number) => {
      if (last !== null) {
        const dt = Math.min(0.1, (now - last) / 1000);
        setT((p) => p + dt);
      }
      last = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // If reduced motion is switched on mid-session, stop.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      if (mq.matches) setPlaying(false);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const T = period(omega);
  const s = state(A, omega, PHI, t, MASS);
  const vMax = A * omega;
  const aMax = omega * omega * A;
  const tInCycle = ((t % T) + T) % T;

  const nearMean = Math.abs(s.x) < 0.02 * A;
  const nearExtreme = Math.abs(s.x) > 0.98 * A;
  const status = nearMean
    ? "Speed maximum, acceleration zero"
    : nearExtreme
      ? "Speed zero, acceleration maximum"
      : s.x * s.v < 0
        ? "Moving toward the mean position: speeding up"
        : "Moving away from the mean position: slowing down";

  // Change ω but keep the phase ωt so the block does not jump.
  const changeOmega = (w: number) => {
    setT((p) => (p * omega) / w);
    setOmega(w);
  };
  // Scrubbing pauses the animation and keeps the elapsed whole periods.
  const scrub = (val: number) => {
    setPlaying(false);
    setT((p) => Math.floor(p / T) * T + val);
  };

  // Scene positions
  const aPx = A * PX_PER_M;
  const blockCx = MEAN_X + s.x * PX_PER_M;
  const blockLeft = blockCx - BLOCK / 2;
  const springY = FLOOR_Y - BLOCK / 2;
  const vLen = (s.v / vMax) * ARROW_MAX;
  const aLen = (s.a / aMax) * ARROW_MAX;
  const keH = (s.KE / s.E) * BAR_H;
  const peH = (s.PE / s.E) * BAR_H;

  const ariaScene =
    `Block on a horizontal spring. Amplitude ${fmt(A, 2)} metres, angular frequency ${fmt(omega, 1)} radians per second. ` +
    `At t = ${fmt(t, 2)} s: displacement ${fmt(s.x, 3)} m, velocity ${fmt(s.v, 3)} m/s, acceleration ${fmt(s.a, 2)} m/s², ` +
    `acceleration points toward the mean position. ${status}.`;

  return (
    <Frame label="Simple harmonic motion: spring-block oscillator">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={ariaScene}
        style={{ display: "block", background: C.surface }}
      >
        {/* floor and wall */}
        <line x1={4} y1={FLOOR_Y} x2={316} y2={FLOOR_Y} stroke={C.ink} strokeWidth={1.5} />
        <rect x={6} y={58} width={WALL_X - 6} height={FLOOR_Y - 58} fill={C.line} stroke={C.ink} strokeWidth={1} />

        {/* mean position */}
        <line x1={MEAN_X} y1={26} x2={MEAN_X} y2={150} stroke={C.ink} strokeWidth={1.2} strokeDasharray="5 4" />
        <text x={MEAN_X} y={16} textAnchor="middle" fontSize={11} fill={C.ink}>
          mean position (x = 0)
        </text>

        {/* extreme positions */}
        {[-1, 1].map((sgn) => {
          const x = MEAN_X + sgn * aPx;
          return (
            <g key={sgn}>
              <line x1={x} y1={60} x2={x} y2={150} stroke={C.muted} strokeWidth={1} strokeDasharray="2 3" />
              <text x={x + sgn * 3} y={161} textAnchor={sgn < 0 ? "end" : "start"} fontSize={11} fill={C.muted}>
                {sgn < 0 ? "−A" : "+A"}
              </text>
              <text x={x + sgn * 3} y={173} textAnchor={sgn < 0 ? "end" : "start"} fontSize={11} fill={C.muted}>
                extreme
              </text>
            </g>
          );
        })}

        {/* amplitude bracket */}
        <path d={`M ${MEAN_X} 182 v 7 H ${MEAN_X + aPx} v -7`} fill="none" stroke={SERIES.displacement} strokeWidth={1.5} />
        <text x={MEAN_X + aPx / 2} y={203} textAnchor="middle" fontSize={12} fontWeight={700} fill={SERIES.displacement}>
          A
        </text>

        {/* spring + block */}
        <polyline
          points={springPath(WALL_X, blockLeft, springY)}
          fill="none"
          stroke={C.muted}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <rect
          x={blockLeft}
          y={FLOOR_Y - BLOCK}
          width={BLOCK}
          height={BLOCK}
          rx={3}
          fill={C.blueSoft}
          stroke={SERIES.displacement}
          strokeWidth={2}
        />
        <text x={blockCx} y={FLOOR_Y - BLOCK / 2 + 4} textAnchor="middle" fontSize={11} fill={C.ink}>
          m
        </text>

        {/* velocity (solid head) and acceleration (hollow head) arrows, length ∝ value */}
        <Arrow x1={blockCx} y1={80} x2={blockCx + vLen} y2={80} color={SERIES.velocity} width={3} head="solid" />
        {Math.abs(vLen) >= 1 && (
          <text
            x={blockCx + vLen + (vLen > 0 ? 4 : -4)}
            y={84}
            textAnchor={vLen > 0 ? "start" : "end"}
            fontSize={11}
            fontWeight={700}
            fill={SERIES.velocity}
          >
            v
          </text>
        )}
        <Arrow x1={blockCx} y1={62} x2={blockCx + aLen} y2={62} color={SERIES.acceleration} width={3} head="hollow" headSize={11} />
        {Math.abs(aLen) >= 1 && (
          <text
            x={blockCx + aLen + (aLen > 0 ? 4 : -4)}
            y={66}
            textAnchor={aLen > 0 ? "start" : "end"}
            fontSize={11}
            fontWeight={700}
            fill={SERIES.acceleration}
          >
            a
          </text>
        )}

        {/* energy bars with constant total-energy line */}
        <text x={366} y={28} textAnchor="middle" fontSize={11} fill={C.muted}>
          energy
        </text>
        <rect x={338} y={BAR_TOP} width={20} height={BAR_H} fill={C.surface2} />
        <rect x={372} y={BAR_TOP} width={20} height={BAR_H} fill={C.surface2} />
        <rect x={338} y={FLOOR_Y - keH} width={20} height={keH} fill={SERIES.kineticEnergy} />
        <rect x={372} y={FLOOR_Y - peH} width={20} height={peH} fill={SERIES.potentialEnergy} />
        <line x1={332} y1={BAR_TOP} x2={398} y2={BAR_TOP} stroke={C.ink} strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={401} y={BAR_TOP + 4} fontSize={11} fontWeight={700} fill={C.ink}>
          E
        </text>
        <line x1={332} y1={FLOOR_Y} x2={398} y2={FLOOR_Y} stroke={C.ink} strokeWidth={1} />
        <text x={348} y={142} textAnchor="middle" fontSize={11} fontWeight={700} fill={SERIES.kineticEnergy}>
          KE
        </text>
        <text x={382} y={142} textAnchor="middle" fontSize={11} fontWeight={700} fill={SERIES.potentialEnergy}>
          PE
        </text>
      </svg>

      <Callout strong={nearMean || nearExtreme}>
        <strong>{status}.</strong>{" "}
        <span style={{ color: C.muted }}>Acceleration always points toward the mean position (a = −ω²x).</span>
      </Callout>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
        <Readout label="time t" value={`${fmt(t, 2)} s`} />
        <Readout label="displacement x" value={`${fmt(s.x, 3)} m`} color={SERIES.displacement} />
        <Readout label="velocity v" value={`${fmt(s.v, 3)} m/s`} color={SERIES.velocity} />
        <Readout label="speed |v|" value={`${fmt(s.speed, 3)} m/s`} color={SERIES.velocity} />
        <Readout label="acceleration a" value={`${fmt(s.a, 2)} m/s²`} color={SERIES.acceleration} />
        <Readout label="kinetic energy KE" value={`${fmt(s.KE * 1000, 1)} mJ`} color={SERIES.kineticEnergy} />
        <Readout label="potential energy PE" value={`${fmt(s.PE * 1000, 1)} mJ`} color={SERIES.potentialEnergy} />
        <Readout label="total energy E" value={`${fmt(s.E * 1000, 1)} mJ`} />
      </dl>

      {!compact && <Graphs A={A} omega={omega} t={t} x={s.x} v={s.v} a={s.a} />}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="llv-btn llv-focus" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
          <span className="llv-num text-sm" style={{ color: C.ink }}>
            T = 2π/ω = {fmt(T, 2)} s
          </span>
          <span className="llv-num text-sm" style={{ color: C.muted }}>
            m = {MASS} kg, k = mω² = {fmt(MASS * omega * omega, 1)} N/m
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RangeControl
            label="Time within one period"
            value={tInCycle}
            min={0}
            max={T}
            step={T / 240}
            onChange={scrub}
            display={`${fmt(tInCycle, 2)} s`}
            valueText={`${fmt(tInCycle, 2)} seconds of a ${fmt(T, 2)} second period`}
          />
          <RangeControl
            label="Amplitude A"
            value={A}
            min={0.05}
            max={0.2}
            step={0.01}
            onChange={setA}
            display={`${fmt(A, 2)} m`}
          />
          <RangeControl
            label="Angular frequency ω"
            value={omega}
            min={1}
            max={6}
            step={0.1}
            onChange={changeOmega}
            display={`${fmt(omega, 1)} rad/s`}
            valueText={`${fmt(omega, 1)} radians per second`}
          />
        </div>
      </div>
    </Frame>
  );
}

// ---------- time graphs ----------

const GW = 220;
const GH = 112;
const GL = 42;
const GR = 10;
const GT = 16;
const GB = 22;
const SAMPLES = 160;

interface GraphsProps {
  A: number;
  omega: number;
  t: number;
  x: number;
  v: number;
  a: number;
}

function Graphs({ A, omega, t, x, v, a }: GraphsProps) {
  const span = 2 * period(omega);
  const series = useMemo(() => {
    const xs: number[] = [];
    const vs: number[] = [];
    const as: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const st = state(A, omega, PHI, (i / SAMPLES) * span, MASS);
      xs.push(st.x);
      vs.push(st.v);
      as.push(st.a);
    }
    return { xs, vs, as };
  }, [A, omega, span]);
  const tc = ((t % span) + span) % span;
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <TimeGraph name="displacement" symbol="x" unit="m" color={SERIES.displacement} data={series.xs} max={A} now={x} tc={tc} span={span} dp={2} />
        <TimeGraph name="velocity" symbol="v" unit="m/s" color={SERIES.velocity} data={series.vs} max={A * omega} now={v} tc={tc} span={span} dp={2} />
        <TimeGraph
          name="acceleration"
          symbol="a"
          unit="m/s²"
          color={SERIES.acceleration}
          data={series.as}
          max={A * omega * omega}
          now={a}
          tc={tc}
          span={span}
          dp={1}
        />
      </div>
      <p className="text-xs m-0 llv-num" style={{ color: C.muted }}>
        Graphs span two periods (2T = {fmt(span, 2)} s). The dashed vertical line marks the current time.
      </p>
    </div>
  );
}

interface TimeGraphProps {
  name: string;
  symbol: string;
  unit: string;
  color: string;
  data: number[];
  max: number;
  now: number;
  tc: number;
  span: number;
  dp: number;
}

function TimeGraph({ name, symbol, unit, color, data, max, now, tc, span, dp }: TimeGraphProps) {
  const pw = GW - GL - GR;
  const ph = GH - GT - GB;
  const midY = GT + ph / 2;
  const toY = (val: number) => midY - (val / max) * (ph / 2);
  const points = data
    .map((val, i) => `${(GL + (i / (data.length - 1)) * pw).toFixed(1)},${toY(val).toFixed(1)}`)
    .join(" ");
  const cx = GL + (tc / span) * pw;
  return (
    <svg
      viewBox={`0 0 ${GW} ${GH}`}
      width="100%"
      role="img"
      aria-label={`Graph of ${name} ${symbol} in ${unit} against time t in seconds over two periods. Current value ${fmt(now, 3)} ${unit}.`}
      style={{ display: "block", background: C.surface2, borderRadius: 8 }}
    >
      <line x1={GL} y1={GT} x2={GL} y2={GT + ph} stroke={C.muted} strokeWidth={1} />
      <line x1={GL} y1={midY} x2={GL + pw} y2={midY} stroke={C.muted} strokeWidth={1} />
      <text x={4} y={11} fontSize={10} fontWeight={700} fill={color}>
        {symbol} ({unit})
      </text>
      <text x={GL - 4} y={GT + 4} textAnchor="end" fontSize={9} fill={C.muted} className="llv-num">
        {fmt(max, dp)}
      </text>
      <text x={GL - 4} y={midY + 3} textAnchor="end" fontSize={9} fill={C.muted}>
        0
      </text>
      <text x={GL - 4} y={GT + ph + 2} textAnchor="end" fontSize={9} fill={C.muted} className="llv-num">
        {fmt(-max, dp)}
      </text>
      {[0, 0.5, 1].map((f, i) => (
        <g key={f}>
          <line x1={GL + f * pw} y1={GT + ph} x2={GL + f * pw} y2={GT + ph + 3} stroke={C.muted} />
          <text x={GL + f * pw} y={GH - 6} textAnchor={i === 2 ? "end" : "middle"} fontSize={9} fill={C.muted}>
            {["0", "T", "2T"][i]}
          </text>
        </g>
      ))}
      <text x={GL + pw} y={midY - 4} textAnchor="end" fontSize={9} fill={C.muted}>
        t (s)
      </text>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <line x1={cx} y1={GT} x2={cx} y2={GT + ph} stroke={C.ink} strokeWidth={1} strokeDasharray="3 2" />
      <circle cx={cx} cy={toY(now)} r={3.5} fill={color} stroke={C.surface} strokeWidth={1} />
    </svg>
  );
}
