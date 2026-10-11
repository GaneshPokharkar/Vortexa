import { C } from "./theme";

interface ArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
  /** "solid" = filled triangle head; "hollow" = open (outlined) triangle head */
  head?: "solid" | "hollow";
  headSize?: number;
  dashed?: boolean;
  opacity?: number;
}

/** Straight arrow from (x1,y1) to (x2,y2). Renders nothing when shorter than 1 unit. */
export function Arrow({ x1, y1, x2, y2, color, width = 2.5, head = "solid", headSize = 9, dashed, opacity }: ArrowProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  const hs = Math.min(headSize, len * 0.7);
  const bx = x2 - ux * hs;
  const by = y2 - uy * hs;
  const px = -uy * hs * 0.55;
  const py = ux * hs * 0.55;
  return (
    <g opacity={opacity}>
      <line
        x1={x1}
        y1={y1}
        x2={bx}
        y2={by}
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      <polygon
        points={`${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`}
        fill={head === "solid" ? color : C.surface}
        stroke={color}
        strokeWidth={head === "solid" ? 1 : 2}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Small direction chevron placed at (x,y) pointing along (dx,dy) — used mid-ray. */
export function RayTick({ x, y, dx, dy, color, size = 6 }: { x: number; y: number; dx: number; dy: number; color: string; size?: number }) {
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  const tx = x + ux * size * 0.6;
  const ty = y + uy * size * 0.6;
  const bx = x - ux * size * 0.6;
  const by = y - uy * size * 0.6;
  const px = -uy * size * 0.5;
  const py = ux * size * 0.5;
  return <polygon points={`${tx},${ty} ${bx + px},${by + py} ${bx - px},${by - py}`} fill={color} />;
}
