// Geometry for the course path: one continuous line through 9 concept nodes that is a sine wave in the
// wave zones and straight zig-zag rays in the ray zone. Pure functions so they can be tested.

export const VIEW = { w: 1000, h: 320 } as const;
const MID = 160;
const AMP = 82;
const LEFT = 70;
const RIGHT = 930;

export type Pt = { x: number; y: number };

export function nodePoints(n = 9): Pt[] {
  const step = (RIGHT - LEFT) / (n - 1);
  return Array.from({ length: n }, (_, i) => ({ x: LEFT + i * step, y: MID + (i % 2 === 0 ? -AMP : AMP) }));
}

/** SVG path data from node a to node b: a half sine period, or a straight ray. */
export function segment(a: Pt, b: Pt, straight: boolean, samples = 24): string {
  if (straight) return `M${a.x},${a.y} L${b.x},${b.y}`;
  const pts = Array.from({ length: samples + 1 }, (_, k) => {
    const t = k / samples;
    // cos from 0 to pi carries y from a.y to b.y with zero slope at both nodes, so segments join smoothly.
    const y = a.y + ((b.y - a.y) * (1 - Math.cos(Math.PI * t))) / 2;
    return `${(a.x + (b.x - a.x) * t).toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts.join(" L")}`;
}

/** Percent position of a point inside the view box, for placing HTML buttons over the SVG. */
export function toPercent(p: Pt): { left: string; top: string } {
  return { left: `${(p.x / VIEW.w) * 100}%`, top: `${(p.y / VIEW.h) * 100}%` };
}
