import { useState } from "react";
import type { VisualCorrection } from "../../lib/api";
import { RangeControl } from "../controls";
import { C, fmt } from "../theme";
import { ideaSpeed, scale, trueSpeed } from "./geometry";
import { IDEA, OverlayFrame, TRUTH } from "./OverlayFrame";

const W = 560;
const H = 330;
const PAD = { l: 64, r: 24, t: 70, b: 52 };

/** S4: "fastest at the ends" (dashed V) against the true speed |v| = ω√(A² − x²) (solid arch). */
export function SpeedOverlay({ correction }: { correction: VisualCorrection }) {
  const A = Number(correction.params.amplitude);
  const w = Number(correction.params.omega);
  const [x, setX] = useState(A * 0.6);

  const vMax = Math.max(A * w, ideaSpeed(w, A)) * 1.1;
  const sx = scale(-A, A, PAD.l, W - PAD.r);
  const sy = scale(0, vMax, H - PAD.b, PAD.t);
  const N = 60;
  const xs = Array.from({ length: N + 1 }, (_, k) => -A + (2 * A * k) / N);
  const truePath = xs.map((xv, k) => `${k ? "L" : "M"} ${sx(xv).toFixed(1)} ${sy(trueSpeed(A, w, xv)).toFixed(1)}`).join(" ");
  const ideaPath = xs.map((xv, k) => `${k ? "L" : "M"} ${sx(xv).toFixed(1)} ${sy(ideaSpeed(w, xv)).toFixed(1)}`).join(" ");

  const vt = trueSpeed(A, w, x);
  const vi = ideaSpeed(w, x);
  const blockW = 30;

  return (
    <OverlayFrame title="Speed across one swing: your idea vs physics" ideaLabel={correction.student_label}
      truthLabel={correction.true_label} caption={correction.caption}>
      {({ idea, truth }) => (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
            aria-label={`At x = ${fmt(x, 3)} m, the real speed is ${fmt(vt, 2)} m/s; the "fastest at the ends" idea predicts ${fmt(vi, 2)} m/s.`}>
            {/* track with the block, so the graph sits under the motion it describes */}
            <line x1={sx(-A)} y1={30} x2={sx(A)} y2={30} stroke={C.line} strokeWidth="2" />
            {[-A, 0, A].map((m) => (
              <g key={m}>
                <line x1={sx(m)} y1={22} x2={sx(m)} y2={38} stroke={C.muted} strokeWidth="1.5" />
                <text x={sx(m)} y={16} fontSize="12" fill={C.muted} textAnchor="middle">
                  {m === 0 ? "mean" : m < 0 ? "−A" : "+A"}
                </text>
              </g>
            ))}
            <rect x={sx(x) - blockW / 2} y={20} width={blockW} height={20} rx="4" fill={C.blueSoft} stroke="#2563EB" strokeWidth="1.5" />

            {/* axes */}
            <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke={C.muted} />
            <line x1={PAD.l} y1={PAD.t - 8} x2={PAD.l} y2={H - PAD.b} stroke={C.muted} />
            <text x={(W + PAD.l) / 2} y={H - 14} fontSize="13" fill={C.muted} textAnchor="middle">displacement x (m)</text>
            <text x={18} y={(PAD.t + H - PAD.b) / 2} fontSize="13" fill={C.muted} textAnchor="middle"
              transform={`rotate(-90 18 ${(PAD.t + H - PAD.b) / 2})`}>speed (m/s)</text>
            {[-A, 0, A].map((m) => (
              <text key={m} x={sx(m)} y={H - PAD.b + 18} fontSize="12" fill={C.muted} textAnchor="middle">{fmt(m, 2)}</text>
            ))}
            <text x={PAD.l - 8} y={sy(A * w) + 4} fontSize="12" fill={C.muted} textAnchor="end">{fmt(A * w, 2)}</text>
            <line x1={PAD.l - 4} y1={sy(A * w)} x2={PAD.l} y2={sy(A * w)} stroke={C.muted} />

            {truth && <path d={truePath} fill="none" stroke={TRUTH} strokeWidth="2.5" />}
            {idea && <path d={ideaPath} fill="none" stroke={IDEA} strokeWidth="2.5" strokeDasharray="7 5" />}

            {/* the block's current position on both curves */}
            <line x1={sx(x)} y1={40} x2={sx(x)} y2={H - PAD.b} stroke={C.line} strokeDasharray="2 4" />
            {truth && <circle cx={sx(x)} cy={sy(vt)} r="5" fill={TRUTH} />}
            {idea && <circle cx={sx(x)} cy={sy(vi)} r="5" fill={C.surface} stroke={IDEA} strokeWidth="2" />}
          </svg>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <RangeControl label="Move the block (displacement x)" value={x} min={-A} max={A} step={A / 100}
              onChange={setX} display={`${fmt(x, 3)} m`} />
            <dl className="m-0 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg px-2.5 py-1.5" style={{ background: C.surface2 }}>
                <dt style={{ color: C.muted }}>Physics</dt>
                <dd className="llv-num m-0 font-semibold" style={{ color: TRUTH }}>{fmt(vt, 2)} m/s</dd>
              </div>
              <div className="rounded-lg px-2.5 py-1.5" style={{ background: C.surface2 }}>
                <dt style={{ color: C.muted }}>Your idea</dt>
                <dd className="llv-num m-0 font-semibold" style={{ color: IDEA }}>{fmt(vi, 2)} m/s</dd>
              </div>
            </dl>
          </div>
        </>
      )}
    </OverlayFrame>
  );
}
