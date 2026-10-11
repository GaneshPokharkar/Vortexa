/**
 * Geometrical optics with the Cartesian sign convention:
 * light travels left → right, distances are measured from the optical centre,
 * a real object has u < 0 and a convex lens has f > 0.
 */
export interface LensImage {
  /** image distance (same unit as u, f); ±Infinity when the image is at infinity */
  v: number;
  /** linear magnification m = v/u; ±Infinity when the image is at infinity */
  m: number;
  real: boolean;
  erect: boolean;
  magnified: boolean;
  atInfinity: boolean;
}

const EPS = 1e-9;

/** Thin-lens formula 1/v − 1/u = 1/f, magnification m = v/u. */
export function lensImage(u: number, f: number): LensImage {
  const denom = u + f;
  if (Math.abs(denom) < EPS * Math.max(1, Math.abs(f))) {
    // Object at the focus: refracted rays emerge parallel. For a convex lens the
    // image is real, inverted and highly magnified, formed at infinity.
    return { v: Infinity, m: -Infinity, real: true, erect: false, magnified: true, atInfinity: true };
  }
  const v = (u * f) / denom;
  const m = v / u;
  return {
    v,
    m,
    real: v > 0,
    erect: m > 0,
    magnified: Math.abs(m) > 1 + EPS,
    atInfinity: false,
  };
}

export interface SnellResult {
  /** angle of refraction in degrees, or null under total internal reflection */
  refractedDeg: number | null;
  tir: boolean;
  /** critical angle in degrees, only defined when n1 > n2 */
  criticalDeg: number | null;
}

const DEG = Math.PI / 180;

/** Snell's law n1 sin θ1 = n2 sin θ2; θ measured from the normal, in degrees. */
export function snell(n1: number, n2: number, thetaDeg: number): SnellResult {
  const criticalDeg = n1 > n2 ? Math.asin(n2 / n1) / DEG : null;
  const s = (n1 * Math.sin(thetaDeg * DEG)) / n2;
  if (s > 1 + 1e-12) return { refractedDeg: null, tir: true, criticalDeg };
  return { refractedDeg: Math.asin(Math.min(1, s)) / DEG, tir: false, criticalDeg };
}
