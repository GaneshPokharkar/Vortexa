import type { VisualCorrection } from "../../lib/api";
import { lensImage } from "../opticsPhysics";
import { Arrow } from "../svgParts";
import { C, fmt } from "../theme";
import { IDEA, OverlayFrame, TRUTH, TRUTH_RAY } from "./OverlayFrame";

const W = 600;
const H = 350;
const AXIS_Y = 175;
const LENS_X = 260;
const LENS_HALF = 110; // lens half-height in px
const OBJ_H = 46; // object height in px

/** R5: "covering half the lens leaves half the image" (dashed half arrow) vs the full, dimmer image. */
export function LensOverlay({ correction }: { correction: VisualCorrection }) {
  const u = Number(correction.params.u);
  const f = Number(correction.params.f);
  const img = lensImage(u, f); // same helper as the lens bench; matches the server's v and m
  const v = img.v;
  const m = img.m;

  // Fit object (left of the lens) and image (right of it) on the bench.
  const k = Math.min((LENS_X - 30) / Math.abs(u), (W - LENS_X - 70) / Math.max(Math.abs(v), 1));
  const X = (cm: number) => LENS_X + cm * k;
  const objX = X(u);
  const imgX = X(v);
  const tip = { x: objX, y: AXIS_Y - OBJ_H };
  const imgTipY = AXIS_Y - OBJ_H * m; // m < 0: inverted, below the axis

  // Every ray from the tip through the open (lower) half meets at the image tip: exact for a thin lens.
  const openHits = [0.15, 0.45, 0.8].map((t) => AXIS_Y + t * LENS_HALF);
  const blocked = [-0.8, -0.45].map((t) => AXIS_Y + t * LENS_HALF);

  return (
    <OverlayFrame title="Half the lens covered: your idea vs physics" ideaLabel={correction.student_label}
      truthLabel={correction.true_label} caption={correction.caption}>
      {({ idea, truth }) => (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
          aria-label={`Object at u = ${fmt(u, 0)} cm, convex lens f = ${fmt(f, 0)} cm, top half covered. The full inverted image forms at v = ${fmt(v, 0)} cm, about half as bright.`}>
          <line x1="10" y1={AXIS_Y} x2={W - 10} y2={AXIS_Y} stroke={C.muted} strokeWidth="1.2" />
          <text x={14} y={AXIS_Y - 8} fontSize="12" fill={C.muted}>principal axis</text>
          {[-1, 1].map((s) => (
            <g key={s}>
              <circle cx={X(s * f)} cy={AXIS_Y} r="3.5" fill={C.muted} />
              <text x={X(s * f)} y={AXIS_Y + 18} fontSize="12" fill={C.muted} textAnchor="middle">{s < 0 ? "F₁" : "F₂"}</text>
            </g>
          ))}

          {/* lens with the top half covered */}
          <ellipse cx={LENS_X} cy={AXIS_Y} rx="11" ry={LENS_HALF} fill="#E3EEFB" stroke="#2563EB" strokeWidth="1.5" />
          <rect x={LENS_X - 14} y={AXIS_Y - LENS_HALF - 4} width="28" height={LENS_HALF + 4} fill="#1F2937" opacity="0.85" rx="3" />
          <text x={LENS_X + 20} y={AXIS_Y - LENS_HALF + 12} fontSize="12" fill={C.muted}>covered</text>

          {/* object */}
          <Arrow x1={objX} y1={AXIS_Y} x2={tip.x} y2={tip.y} color={TRUTH} width={3} />
          <text x={objX} y={AXIS_Y + 18} fontSize="12" fill={C.muted} textAnchor="middle">object</text>

          {/* rays the paper stops */}
          {blocked.map((y) => (
            <line key={y} x1={tip.x} y1={tip.y} x2={LENS_X - 14} y2={y} stroke={TRUTH_RAY} strokeWidth="1.5" opacity="0.35" />
          ))}

          {truth && (
            <g>
              {openHits.map((y) => (
                <g key={y}>
                  <line x1={tip.x} y1={tip.y} x2={LENS_X} y2={y} stroke={TRUTH_RAY} strokeWidth="2" />
                  <line x1={LENS_X} y1={y} x2={imgX} y2={imgTipY} stroke={TRUTH_RAY} strokeWidth="2" />
                </g>
              ))}
              <g opacity="0.55">
                <Arrow x1={imgX} y1={AXIS_Y} x2={imgX} y2={imgTipY} color={TRUTH} width={3.5} />
              </g>
              <text x={imgX - 8} y={imgTipY + 18} fontSize="12.5" fill={TRUTH} textAnchor="end">full image, about half as bright</text>
            </g>
          )}

          {idea && (
            <g>
              <line x1={imgX - 12} y1={AXIS_Y} x2={imgX - 12} y2={(AXIS_Y + imgTipY) / 2} stroke={IDEA} strokeWidth="3" strokeDasharray="6 4" />
              <line x1={imgX - 20} y1={(AXIS_Y + imgTipY) / 2} x2={imgX - 4} y2={(AXIS_Y + imgTipY) / 2} stroke={IDEA} strokeWidth="2" />
              <text x={imgX - 8} y={AXIS_Y - 12} fontSize="12.5" fill={IDEA} textAnchor="end">your idea: half an image</text>
            </g>
          )}

          <text x={imgX + 6} y={AXIS_Y + 18} fontSize="12" fill={C.muted}>v = {fmt(v, 0)} cm</text>
        </svg>
      )}
    </OverlayFrame>
  );
}
