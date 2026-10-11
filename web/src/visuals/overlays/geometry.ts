// Pure geometry for the "your idea vs physics" overlays. Bearings are in degrees: 0 = straight up,
// 90 = right, 180 = down, -90 = left (screen y grows downward). All angles from the normal are physics angles.

export type Pt = { x: number; y: number };

const RAD = Math.PI / 180;

/** Point at `r` from (cx, cy) along a bearing. */
export function polar(cx: number, cy: number, r: number, bearing: number): Pt {
  return { x: cx + r * Math.sin(bearing * RAD), y: cy - r * Math.cos(bearing * RAD) };
}

/** SVG path for the arc between two bearings (shorter way round). */
export function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const sweep = to > from ? 1 : 0;
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** Interface is horizontal through the hit point; light arrives from the upper left. */
export const bearings = {
  incidentSource: (i: number) => -i, // where the incoming ray comes from
  reflected: (i: number) => i,
  refracted: (r: number) => 180 - r,
  surfaceLeft: -90,
  normalUp: 0,
  normalDown: 180,
};

/** The student's "angle of incidence" when measured from the surface instead of the normal. */
export const angleFromSurface = (incidence: number) => 90 - incidence;

/** Speed of an ideal SHM oscillator at displacement x: ω√(A² − x²). */
export const trueSpeed = (A: number, omega: number, x: number) => omega * Math.sqrt(Math.max(A * A - x * x, 0));

/** The "fastest at the ends" picture: speed growing with distance from the mean (what the backend sends). */
export const ideaSpeed = (omega: number, x: number) => omega * Math.abs(x);

/** Map a value in [d0, d1] to [r0, r1]. */
export const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
