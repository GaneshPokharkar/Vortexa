import { useId, useState } from "react";
import { Callout, Frame, RangeControl, Readout } from "./controls";
import { snell } from "./opticsPhysics";
import { RayTick } from "./svgParts";
import { C, SERIES, fmt } from "./theme";

const MEDIA = [
  { name: "air", n: 1.0 },
  { name: "water", n: 1.33 },
  { name: "glass", n: 1.5 },
  { name: "diamond", n: 2.42 },
] as const;

const W = 400;
const H = 300;
const OX = 200;
const OY = 150;
const R = 130;
const DEG = Math.PI / 180;
/** Light outline behind text so labels stay readable where they cross a ray. */
const HALO = { paintOrder: "stroke", stroke: C.surface, strokeWidth: 4, strokeLinejoin: "round" } as const;

/** Unit direction for an angle θ (deg) from a vertical normal. side: −1 left, +1 right; up: −1 upward, +1 downward (SVG y). */
function dir(thetaDeg: number, side: number, up: number) {
  return { x: side * Math.sin(thetaDeg * DEG), y: up * Math.cos(thetaDeg * DEG) };
}

/** Arc between the normal and a ray, plus label at the bisector. */
function AngleMark({
  thetaDeg,
  side,
  up,
  r,
  color,
  label,
}: {
  thetaDeg: number;
  side: number;
  up: number;
  r: number;
  color: string;
  label: string;
}) {
  if (thetaDeg < 0.5) return null;
  const s = { x: OX, y: OY + up * r };
  const e = dir(thetaDeg, side, up);
  // Visual sweep: up-left and down-right are counter-clockwise (0); the mirror cases are clockwise (1).
  const sweep = side * up > 0 ? 0 : 1;
  const mid = dir(thetaDeg / 2, side, up);
  return (
    <g>
      <path
        d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 ${sweep} ${OX + e.x * r} ${OY + e.y * r}`}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
      <text
        x={OX + mid.x * (r + 10)}
        y={OY + mid.y * (r + 10) + 4}
        textAnchor={side < 0 ? "end" : "start"}
        fontSize={13}
        fontWeight={600}
        fill={color}
        className="llv-num"
        {...HALO}
      >
        {label}
      </text>
    </g>
  );
}

function MediumSelect({ label, value, onChange }: { label: string; value: number; onChange: (i: number) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="text-sm" style={{ color: C.ink }}>
        {label}
      </label>
      <select
        id={id}
        className="llv-select llv-focus"
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      >
        {MEDIA.map((m, i) => (
          <option key={m.name} value={i}>
            {m.name} (n = {m.n.toFixed(2)})
          </option>
        ))}
      </select>
    </div>
  );
}

export function Refraction() {
  const [i1, setI1] = useState(2); // glass on top
  const [i2, setI2] = useState(0); // air below
  const [theta, setTheta] = useState(30);
  const m1 = MEDIA[i1];
  const m2 = MEDIA[i2];
  const res = snell(m1.n, m2.n, theta);

  const inc = dir(theta, -1, -1); // from O back toward the source (upper left)
  const refl = dir(theta, 1, -1);
  const refr = res.refractedDeg === null ? null : dir(res.refractedDeg, 1, 1);

  const bending =
    theta === 0
      ? "No bending along the normal"
      : res.tir
        ? null
        : m1.n === m2.n
          ? "No bending: both media have the same refractive index"
          : m2.n > m1.n
            ? "Bends toward the normal (rarer to denser)"
            : "Bends away from the normal (denser to rarer)";

  // Tint: denser medium is drawn more strongly.
  const tint = (n: number) => 0.15 + ((n - 1) / 1.42) * 0.85;

  const aria =
    `Light ray going from ${m1.name} (n = ${m1.n.toFixed(2)}) into ${m2.name} (n = ${m2.n.toFixed(2)}) at ${fmt(theta, 0)} degrees to the normal. ` +
    (res.tir
      ? `Total internal reflection: no refracted ray; all light reflects at ${fmt(theta, 0)} degrees.`
      : `Refracted at ${fmt(res.refractedDeg ?? 0, 1)} degrees. ${bending}.`) +
    (res.criticalDeg !== null ? ` Critical angle ${fmt(res.criticalDeg, 1)} degrees.` : "");

  return (
    <Frame label="Refraction at a boundary and total internal reflection">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={aria} style={{ display: "block", background: C.surface }}>
        {/* media */}
        <rect x={0} y={0} width={W} height={OY} fill={C.blueSoft} opacity={tint(m1.n)} />
        <rect x={0} y={OY} width={W} height={H - OY} fill={C.blueSoft} opacity={tint(m2.n)} />
        <line x1={0} y1={OY} x2={W} y2={OY} stroke={C.ink} strokeWidth={1.5} />
        <text x={10} y={22} fontSize={13} fontWeight={600} fill={C.ink} className="llv-num">
          n₁ = {m1.n.toFixed(2)} ({m1.name})
        </text>
        <text x={10} y={H - 12} fontSize={13} fontWeight={600} fill={C.ink} className="llv-num">
          n₂ = {m2.n.toFixed(2)} ({m2.name})
        </text>

        {/* normal */}
        <line x1={OX} y1={14} x2={OX} y2={H - 14} stroke={C.muted} strokeWidth={1.2} strokeDasharray="6 4" />
        <text x={OX + 6} y={28} fontSize={11} fill={C.muted}>
          normal
        </text>

        {/* critical angle guide */}
        {res.criticalDeg !== null && (
          <g>
            <line
              x1={OX}
              y1={OY}
              x2={OX + dir(res.criticalDeg, -1, -1).x * (R + 6)}
              y2={OY + dir(res.criticalDeg, -1, -1).y * (R + 6)}
              stroke={C.muted}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text
              x={OX + dir(res.criticalDeg, -1, -1).x * (R + 10)}
              y={OY + dir(res.criticalDeg, -1, -1).y * (R + 10)}
              textAnchor="end"
              fontSize={11}
              fill={C.muted}
            >
              θc
            </text>
          </g>
        )}

        {/* reflected ray: faint (partial reflection) unless TIR */}
        <line
          x1={OX}
          y1={OY}
          x2={OX + refl.x * R}
          y2={OY + refl.y * R}
          stroke={SERIES.ray}
          strokeWidth={res.tir ? 3 : 1.5}
          opacity={res.tir ? 1 : 0.3}
        />
        <RayTick
          x={OX + refl.x * R * 0.6}
          y={OY + refl.y * R * 0.6}
          dx={refl.x}
          dy={refl.y}
          color={SERIES.ray}
          size={res.tir ? 10 : 7}
        />

        {/* incident ray */}
        <line x1={OX + inc.x * R} y1={OY + inc.y * R} x2={OX} y2={OY} stroke={SERIES.ray} strokeWidth={3} />
        <RayTick x={OX + inc.x * R * 0.5} y={OY + inc.y * R * 0.5} dx={-inc.x} dy={-inc.y} color={SERIES.ray} size={10} />

        {/* refracted ray */}
        {refr && (
          <g>
            <line x1={OX} y1={OY} x2={OX + refr.x * R} y2={OY + refr.y * R} stroke={SERIES.ray} strokeWidth={3} />
            <RayTick x={OX + refr.x * R * 0.6} y={OY + refr.y * R * 0.6} dx={refr.x} dy={refr.y} color={SERIES.ray} size={10} />
          </g>
        )}

        <AngleMark thetaDeg={theta} side={-1} up={-1} r={40} color={C.ink} label={`θ₁ = ${fmt(theta, 1)}°`} />
        {res.refractedDeg !== null && (
          <AngleMark thetaDeg={res.refractedDeg} side={1} up={1} r={40} color={C.ink} label={`θ₂ = ${fmt(res.refractedDeg, 1)}°`} />
        )}
        {res.tir && <AngleMark thetaDeg={theta} side={1} up={-1} r={40} color={C.ink} label={`θr = ${fmt(theta, 1)}°`} />}
        <circle cx={OX} cy={OY} r={3} fill={C.ink} />
      </svg>

      {res.tir ? (
        <Callout strong>
          <strong>Total internal reflection: light goes from denser to rarer AND angle &gt; critical angle.</strong> No light
          is refracted; all of it reflects back into {m1.name}.
        </Callout>
      ) : (
        <Callout strong={theta > 0 && m1.n !== m2.n}>
          <strong>{bending}.</strong> Some light is also reflected (faint ray).
        </Callout>
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
        <Readout label="angle of incidence θ₁" value={`${fmt(theta, 1)}°`} />
        <Readout label="angle of refraction θ₂" value={res.refractedDeg === null ? "none (TIR)" : `${fmt(res.refractedDeg, 1)}°`} />
        <Readout label="angle of reflection θr" value={`${fmt(theta, 1)}°`} />
        <Readout
          label="critical angle θc"
          value={res.criticalDeg === null ? "none (n₁ ≤ n₂)" : `${fmt(res.criticalDeg, 1)}°`}
        />
      </dl>
      <p className="text-sm m-0 llv-num" style={{ color: C.muted }}>
        n₁ sin θ₁ = n₂ sin θ₂: {m1.n.toFixed(2)} × sin {fmt(theta, 1)}° = {fmt(m1.n * Math.sin(theta * DEG), 3)}
        {res.criticalDeg !== null && <> · sin θc = n₂/n₁ = {fmt(m2.n / m1.n, 3)}</>}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MediumSelect label="Top medium (n₁, light comes from here)" value={i1} onChange={setI1} />
        <MediumSelect label="Bottom medium (n₂)" value={i2} onChange={setI2} />
        <RangeControl
          label="Angle of incidence θ₁"
          value={theta}
          min={0}
          max={89}
          step={1}
          onChange={setTheta}
          display={`${fmt(theta, 0)}°`}
          valueText={`${fmt(theta, 0)} degrees`}
        />
      </div>
    </Frame>
  );
}
