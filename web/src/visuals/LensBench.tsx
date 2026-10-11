import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Callout, Frame, RangeControl, Readout } from "./controls";
import { lensImage } from "./opticsPhysics";
import { RayTick } from "./svgParts";
import { C, SERIES, fmt, fmtSigned } from "./theme";

// Bench geometry. x in cm (lens at 0), y in "object heights" (object = H_OBJ).
// Scaling x and y separately is an affine map, so straight rays and their
// crossing points stay exact.
const W = 480;
const H = 290;
const CX = 240;
const AXIS_Y = 150;
const SX = 3.6; // px per cm -> ±66 cm visible
const SY = 38; // px per height unit
const H_OBJ = 1.2;
const LENS_HALF = 3.0;
const X_VISIBLE = (W - CX) / SX;
const X_END = 80; // rays drawn out to here (clipped by the viewBox)
const U_MIN = 4;
const U_MAX = 60;

const px = (x: number) => CX + x * SX;
const py = (y: number) => AXIS_Y - y * SY;

type LensKind = "convex" | "concave";

interface Ray {
  /** height where the ray meets the lens */
  yL: number;
  principal: boolean;
  kind?: "parallel" | "centre" | "focal";
}

function natureText(real: boolean, erect: boolean, m: number, atInfinity: boolean) {
  if (atInfinity) return "Real, Inverted, Highly magnified (image at infinity)";
  const am = Math.abs(m);
  const size = Math.abs(am - 1) < 0.02 ? "Same size" : am > 1 ? "Magnified" : "Diminished";
  return `${real ? "Real" : "Virtual"}, ${erect ? "Erect" : "Inverted"}, ${size}`;
}

function objectPlace(uAbs: number, f: number): string {
  if (f < 0)
    return "Concave lens, object anywhere in front: the image is virtual, erect and diminished, between F₁ and the lens, on the same side as the object";
  const tol = 0.25;
  if (Math.abs(uAbs - 2 * f) < tol) return "Object at 2F₁";
  if (uAbs > 2 * f) return "Object beyond 2F₁";
  if (Math.abs(uAbs - f) < tol) return "Object at F₁";
  if (uAbs > f) return "Object between F₁ and 2F₁";
  return "Object between F₁ and the optical centre O";
}

export function LensBench() {
  const [uAbs, setUAbs] = useState(30);
  const [fAbs, setFAbs] = useState(20);
  const [lens, setLens] = useState<LensKind>("convex");
  const concave = lens === "concave";
  const f = concave ? -fAbs : fAbs;
  const [covered, setCovered] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const u = -uAbs;
  const img = lensImage(u, f);
  const hImg = img.atInfinity ? 0 : img.m * H_OBJ;

  // All rays leave the object tip P = (u, H_OBJ). Thin lens: slope_out = slope_in − yL/f.
  // Ray 3 lies on the line through P and the first focal point (−f, 0): F₁ for convex, F₂ on
  // the far side for concave. It meets the lens at y = h·f/(f + u) and leaves parallel.
  const yFocal = img.atInfinity ? null : (H_OBJ * f) / (f + u);
  const principal: Ray[] = [
    { yL: H_OBJ, principal: true, kind: "parallel" }, // convex: through F₂; concave: as if from F₁
    { yL: 0, principal: true, kind: "centre" }, // through optical centre, undeviated
  ];
  if (yFocal !== null && Math.abs(yFocal) < 12) principal.push({ yL: yFocal, principal: true, kind: "focal" }); // → parallel
  const rays: Ray[] = covered
    ? [
        ...principal.filter((r) => r.yL < 0 && r.yL >= -LENS_HALF),
        { yL: -0.8, principal: false },
        { yL: -1.7, principal: false },
        { yL: -2.6, principal: false },
      ]
    : principal;

  const toWorldX = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return (p.x - CX) / SX;
  };
  const dragTo = (e: ReactPointerEvent<SVGElement>) => {
    const x = toWorldX(e.clientX, e.clientY);
    if (x === null) return;
    setUAbs(Math.round(Math.min(U_MAX, Math.max(U_MIN, -x))));
  };

  const imgOpacity = covered ? 0.5 : 1;
  // Keep the image label on screen: put it on the lens side when near the right edge.
  const imgLabelEnd = !img.real || px(img.v) > W - 110;
  const imgColor = img.real ? SERIES.realImage : SERIES.virtualImage;
  const imageOffBench = !img.atInfinity && Math.abs(img.v) > X_VISIBLE - 2;
  const nature = natureText(img.real, img.erect, img.m, img.atInfinity);

  // One sentence with the full state: the AI tutor reads it to explain what the student sees.
  const aria =
    `Optical bench with a ${lens} lens of focal length f = ${fmtSigned(f, 0)} cm and the object at u = ${fmtSigned(u, 0)} cm` +
    (img.atInfinity
      ? ", which is at the focus, so the refracted rays are parallel and the image is at infinity (real, inverted, highly magnified)"
      : `, giving the image at v = ${fmtSigned(img.v, 1)} cm with magnification m = ${fmtSigned(img.m, 2)}, ${nature.toLowerCase()}` +
        (concave ? ", between F₁ and the lens, on the same side as the object" : "")) +
    (covered ? "; the top half of the lens is covered, so the full image still forms but is dimmer" : "") +
    ".";

  const x0 = px(0);
  const lensPath = concave
    ? `M ${x0 - 12} ${py(LENS_HALF)} L ${x0 + 12} ${py(LENS_HALF)} Q ${x0 - 6} ${AXIS_Y} ${x0 + 12} ${py(-LENS_HALF)} L ${x0 - 12} ${py(-LENS_HALF)} Q ${x0 + 6} ${AXIS_Y} ${x0 - 12} ${py(LENS_HALF)} Z`
    : `M ${x0} ${py(LENS_HALF)} Q ${x0 + 16} ${AXIS_Y} ${x0} ${py(-LENS_HALF)} Q ${x0 - 16} ${AXIS_Y} ${x0} ${py(LENS_HALF)} Z`;

  return (
    <Frame label={`${concave ? "Concave" : "Convex"} lens optical bench`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={aria}
        style={{ display: "block", background: C.surface, touchAction: "pan-y" }}
      >
        {/* principal axis */}
        <line x1={0} y1={AXIS_Y} x2={W} y2={AXIS_Y} stroke={C.ink} strokeWidth={1.2} />
        <text x={4} y={AXIS_Y + 34} textAnchor="start" fontSize={13} fill={C.muted}>
          principal axis
        </text>

        {/* lens */}
        <path d={lensPath} fill={C.blueSoft} stroke={C.blue} strokeWidth={1.5} opacity={0.9} />
        <text x={px(0)} y={py(LENS_HALF) - 8} textAnchor="middle" fontSize={14} fill={C.ink}>
          {lens} lens
        </text>
        <circle cx={px(0)} cy={AXIS_Y} r={2.5} fill={C.ink} />
        <text x={px(0) + 5} y={AXIS_Y + 15} fontSize={14} fill={C.ink}>
          O
        </text>
        {covered && (
          <g>
            <rect x={px(0) - 11} y={py(LENS_HALF) - 2} width={22} height={LENS_HALF * SY + 2} fill={C.ink} opacity={0.85} rx={2} />
            <text x={px(0) + 14} y={py(LENS_HALF / 2)} fontSize={13} fill={C.ink}>
              covered
            </text>
          </g>
        )}

        {/* F and 2F on both sides */}
        {(concave
          ? [
              { x: -fAbs, l: "F₁" },
              { x: fAbs, l: "F₂" },
            ]
          : [
              { x: -2 * f, l: "2F₁" },
              { x: -f, l: "F₁" },
              { x: f, l: "F₂" },
              { x: 2 * f, l: "2F₂" },
            ]
        ).map((m) => (
          <g key={m.l}>
            <line x1={px(m.x)} y1={AXIS_Y - 5} x2={px(m.x)} y2={AXIS_Y + 5} stroke={C.ink} strokeWidth={1.5} />
            <text x={px(m.x)} y={AXIS_Y + 20} textAnchor="middle" fontSize={14} fontWeight={600} fill={C.ink}>
              {m.l}
            </text>
          </g>
        ))}

        {/* rays */}
        {rays.map((r, i) => {
          const sIn = (r.yL - H_OBJ) / (0 - u);
          const sOut = sIn - r.yL / f;
          const yEnd = r.yL + sOut * X_END;
          const width = r.principal ? 1.8 : 1.2;
          // Backward extension for a virtual image; the concave parallel ray is traced back to F₁.
          const xBack = concave && r.kind === "parallel" ? f : img.v;
          return (
            <g key={i}>
              <line x1={px(u)} y1={py(H_OBJ)} x2={px(0)} y2={py(r.yL)} stroke={SERIES.ray} strokeWidth={width} />
              <RayTick x={px(u / 2)} y={py((H_OBJ + r.yL) / 2)} dx={SX} dy={-sIn * SY} color={SERIES.ray} />
              <line x1={px(0)} y1={py(r.yL)} x2={px(X_END)} y2={py(yEnd)} stroke={SERIES.ray} strokeWidth={width} />
              <RayTick x={px(14)} y={py(r.yL + sOut * 14)} dx={SX} dy={-sOut * SY} color={SERIES.ray} />
              {!img.real && !img.atInfinity && (
                <line
                  x1={px(0)}
                  y1={py(r.yL)}
                  x2={px(xBack)}
                  y2={py(r.yL + sOut * xBack)}
                  stroke={SERIES.ray}
                  strokeWidth={1.2}
                  strokeDasharray="5 4"
                  opacity={0.8}
                />
              )}
              {concave && r.kind === "focal" && (
                // where the incident ray was heading: F₂ on the far side
                <line
                  x1={px(0)}
                  y1={py(r.yL)}
                  x2={px(fAbs)}
                  y2={AXIS_Y}
                  stroke={SERIES.ray}
                  strokeWidth={1.2}
                  strokeDasharray="2 4"
                  opacity={0.6}
                />
              )}
            </g>
          );
        })}

        {/* image */}
        {!img.atInfinity && (
          <g opacity={imgOpacity}>
            <line
              x1={px(img.v)}
              y1={AXIS_Y}
              x2={px(img.v)}
              y2={py(hImg)}
              stroke={imgColor}
              strokeWidth={3}
              strokeDasharray={img.real ? undefined : "6 4"}
            />
            <polygon
              points={`${px(img.v)},${py(hImg)} ${px(img.v) - 6},${py(hImg) + (hImg > 0 ? 10 : -10)} ${px(img.v) + 6},${py(hImg) + (hImg > 0 ? 10 : -10)}`}
              fill={img.real ? imgColor : C.surface}
              stroke={imgColor}
              strokeWidth={1.5}
            />
            {/* concave image is small and sits among the rays: label it below the axis */}
            <text
              x={concave ? px(img.v) : px(img.v) + (imgLabelEnd ? -8 : 8)}
              y={concave ? AXIS_Y + 40 : py(hImg) + (hImg > 0 ? -6 : 16)}
              textAnchor={concave ? "middle" : imgLabelEnd ? "end" : "start"}
              fontSize={14}
              fontWeight={600}
              fill={imgColor}
            >
              {img.real ? "real image" : "virtual image"}
            </text>
          </g>
        )}

        {/* object (draggable) */}
        <g>
          <line x1={px(u)} y1={AXIS_Y} x2={px(u)} y2={py(H_OBJ) + 9} stroke={SERIES.displacement} strokeWidth={3} />
          <polygon
            points={`${px(u)},${py(H_OBJ)} ${px(u) - 6},${py(H_OBJ) + 10} ${px(u) + 6},${py(H_OBJ) + 10}`}
            fill={SERIES.displacement}
          />
          <text x={px(u)} y={py(H_OBJ) - 8} textAnchor="middle" fontSize={14} fontWeight={600} fill={SERIES.displacement}>
            object
          </text>
          <rect
            x={px(u) - 14}
            y={py(H_OBJ) - 22}
            width={28}
            height={H_OBJ * SY + 30}
            fill="transparent"
            style={{ cursor: "ew-resize", touchAction: "none" }}
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (dragging.current) dragTo(e);
            }}
            onPointerUp={(e) => {
              dragging.current = false;
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
          />
        </g>
      </svg>

      <Callout strong>
        <strong>{nature}</strong>
        {covered && !img.atInfinity && <span> · Full image, dimmer</span>}
      </Callout>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
        <Readout label="object distance u" value={`${fmtSigned(u, 1)} cm`} />
        <Readout label="image distance v" value={img.atInfinity ? "∞ (at infinity)" : `${fmtSigned(img.v, 1)} cm`} />
        <Readout label="focal length f" value={`${fmtSigned(f, 1)} cm`} />
        <Readout label="magnification m = v/u" value={img.atInfinity ? "very large" : fmtSigned(img.m, 2)} />
      </dl>

      <p className="text-sm m-0 llv-num" style={{ color: C.muted }}>
        {objectPlace(uAbs, f)}.{" "}
        {img.atInfinity
          ? "Rays leave the lens parallel, so they meet only at infinity."
          : `1/v − 1/u = 1/f: 1/(${fmtSigned(img.v, 1)}) − 1/(${fmtSigned(u, 1)}) = 1/(${fmtSigned(f, 1)}).`}{" "}
        {imageOffBench && "The image lies beyond the edge of the bench."}
        {covered &&
          " Covering half the lens blocks some rays, but every point of the object still sends rays through the open half, so the whole image forms with less light."}
      </p>

      <div
        role="group"
        aria-label="Lens type"
        className="flex self-start rounded-lg overflow-hidden"
        style={{ border: `1px solid ${C.blue}` }}
      >
        {(["convex", "concave"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={lens === k}
            onClick={() => setLens(k)}
            className="llv-focus text-sm font-semibold px-4"
            style={{
              minHeight: 36,
              cursor: "pointer",
              border: "none",
              background: lens === k ? C.blue : C.surface,
              color: lens === k ? "#FFFFFF" : C.ink,
            }}
          >
            {k === "convex" ? "Convex" : "Concave"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RangeControl
          label="Object distance |u| (or drag the object)"
          value={uAbs}
          min={U_MIN}
          max={U_MAX}
          step={1}
          onChange={setUAbs}
          display={`${fmt(uAbs, 0)} cm`}
          valueText={`object ${fmt(uAbs, 0)} centimetres left of the lens`}
        />
        <RangeControl
          label={concave ? "Focal length |f| (f is negative)" : "Focal length f"}
          value={fAbs}
          min={10}
          max={20}
          step={1}
          onChange={setFAbs}
          display={`${fmt(f, 0)} cm`}
          valueText={`${fmt(f, 0)} centimetres`}
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.ink }}>
        <input
          type="checkbox"
          className="llv-check llv-focus"
          checked={covered}
          onChange={(e) => setCovered(e.currentTarget.checked)}
        />
        Cover top half of lens
      </label>
    </Frame>
  );
}
