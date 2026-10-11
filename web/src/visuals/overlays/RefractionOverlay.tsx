import type { VisualCorrection } from "../../lib/api";
import { snell } from "../opticsPhysics";
import { RayTick } from "../svgParts";
import { C, fmt } from "../theme";
import { angleFromSurface, arc, bearings, polar } from "./geometry";
import { IDEA, OverlayFrame, TRUTH, TRUTH_RAY } from "./OverlayFrame";

const W = 560;
const H = 380;
const CX = W / 2;
const CY = H / 2;
const L = 165; // ray length in px

const MEDIUM: Record<string, string> = { "1": "air", "1.33": "water", "1.5": "glass", "2.42": "diamond" };
const mediumName = (n: number) => MEDIUM[String(Math.round(n * 100) / 100)] ?? `n = ${fmt(n, 2)}`;

/** R7 (angle measured from the surface) and R3 (always bends toward the normal) over the true refraction. */
export function RefractionOverlay({ correction }: { correction: VisualCorrection }) {
  const p = correction.params as Record<string, number | null>;
  const n1 = p.n1 as number;
  const n2 = p.n2 as number;
  const i = p.incidence as number;
  const fromSurface = correction.overlay === "angle-from-surface";

  // Recompute with the same tested helper the bench uses; the server's numbers must agree.
  const truth = snell(n1, n2, i);
  const ideaIncidence = fromSurface ? angleFromSurface(i) : i;
  const idea = fromSurface
    ? snell(n1, n2, ideaIncidence)
    : { refractedDeg: p.student_refracted as number, tir: false, criticalDeg: null };

  const src = polar(CX, CY, L, bearings.incidentSource(i));
  const truthEnd = truth.tir ? polar(CX, CY, L, bearings.reflected(i)) : polar(CX, CY, L, bearings.refracted(truth.refractedDeg!));
  const ideaEnd = idea.tir || idea.refractedDeg === null
    ? polar(CX, CY, L, bearings.reflected(i))
    : polar(CX, CY, L, bearings.refracted(idea.refractedDeg));

  const truthText = truth.tir ? "totally internally reflected" : `refracted at ${fmt(truth.refractedDeg!, 1)}°`;
  const ideaText = idea.tir || idea.refractedDeg === null ? "reflected back (TIR)" : `refracted at ${fmt(idea.refractedDeg, 1)}°`;
  const summary = `Light from ${mediumName(n1)} (n ${fmt(n1, 2)}) to ${mediumName(n2)} (n ${fmt(n2, 2)}), incidence ${fmt(i, 0)}° from the normal. ` +
    `Physics: ${truthText}. Your idea: ${ideaText}.`;

  return (
    <OverlayFrame
      title={fromSurface ? "Angle measured from the surface vs from the normal" : "Bending toward vs away from the normal"}
      ideaLabel={correction.student_label}
      truthLabel={correction.true_label}
      caption={correction.caption}
    >
      {({ idea: showIdea, truth: showTruth }) => (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary}>
          {/* media */}
          <rect x="0" y="0" width={W} height={CY} fill={n1 > n2 ? "#E3EEFB" : C.surface} />
          <rect x="0" y={CY} width={W} height={H - CY} fill={n2 > n1 ? "#E3EEFB" : C.surface} />
          <line x1="0" y1={CY} x2={W} y2={CY} stroke={C.muted} strokeWidth="1.5" />
          <text x="14" y="24" fontSize="14" fill={C.muted}>{mediumName(n1)} · n₁ = {fmt(n1, 2)}</text>
          <text x="14" y={H - 14} fontSize="14" fill={C.muted}>{mediumName(n2)} · n₂ = {fmt(n2, 2)}</text>

          {/* normal */}
          <line x1={CX} y1={CY - L - 12} x2={CX} y2={CY + L + 12} stroke={C.muted} strokeWidth="1.2" strokeDasharray="3 5" />
          <text x={CX + 6} y={CY - L - 2} fontSize="12.5" fill={C.muted}>normal</text>

          {/* incident ray (shared) */}
          <line x1={src.x} y1={src.y} x2={CX} y2={CY} stroke={TRUTH_RAY} strokeWidth="3" />
          <RayTick x={(src.x + CX) / 2} y={(src.y + CY) / 2} dx={CX - src.x} dy={CY - src.y} color={TRUTH_RAY} size={10} />

          {showTruth && (
            <g>
              <path d={arc(CX, CY, 58, bearings.incidentSource(i), bearings.normalUp)} fill="none" stroke={TRUTH} strokeWidth="2" />
              <text {...polar(CX, CY, 76, bearings.incidentSource(i) / 2)} fontSize="14" fontWeight="600" fill={TRUTH} textAnchor="middle">
                i = {fmt(i, 0)}°
              </text>
              <line x1={CX} y1={CY} x2={truthEnd.x} y2={truthEnd.y} stroke={TRUTH_RAY} strokeWidth="3" />
              <RayTick x={(CX + truthEnd.x) / 2} y={(CY + truthEnd.y) / 2} dx={truthEnd.x - CX} dy={truthEnd.y - CY} color={TRUTH_RAY} size={10} />
              {!truth.tir && (
                <>
                  <path d={arc(CX, CY, 46, bearings.normalDown, bearings.refracted(truth.refractedDeg!))} fill="none" stroke={TRUTH} strokeWidth="2" />
                  {/* label sits just outside the true ray, away from the dashed idea ray nearer the normal */}
                  <text {...polar(CX, CY, 78, bearings.refracted(truth.refractedDeg!) - 14)} fontSize="14" fontWeight="600" fill={TRUTH} textAnchor="middle">
                    r = {fmt(truth.refractedDeg!, 1)}°
                  </text>
                </>
              )}
              {truth.tir && (
                <text x={truthEnd.x - 8} y={truthEnd.y - 6} fontSize="13" fill={TRUTH} textAnchor="end">total internal reflection</text>
              )}
            </g>
          )}

          {showIdea && (
            <g>
              {fromSurface && (
                <>
                  <path d={arc(CX, CY, 104, bearings.surfaceLeft, bearings.incidentSource(i))} fill="none" stroke={IDEA} strokeWidth="2" strokeDasharray="5 4" />
                  <text {...polar(CX, CY, 124, (bearings.surfaceLeft + bearings.incidentSource(i)) / 2)} fontSize="14" fontWeight="600" fill={IDEA} textAnchor="middle">
                    {fmt(ideaIncidence, 0)}°
                  </text>
                </>
              )}
              <line x1={CX} y1={CY} x2={ideaEnd.x} y2={ideaEnd.y} stroke={IDEA} strokeWidth="2.5" strokeDasharray="7 5" />
              <text x={ideaEnd.x + (ideaEnd.x > CX ? -6 : 6)} y={ideaEnd.y + (ideaEnd.y > CY ? 18 : -8)} fontSize="13" fill={IDEA}
                textAnchor={ideaEnd.x > CX ? "end" : "start"}>
                your prediction: {ideaText}
              </text>
            </g>
          )}
        </svg>
      )}
    </OverlayFrame>
  );
}
