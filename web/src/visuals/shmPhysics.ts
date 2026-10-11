/**
 * Simple harmonic motion, convention x = A cos(ωt + φ).
 * All quantities in SI units (m, s, kg, J).
 */
export interface ShmState {
  /** displacement from the mean position (m) */
  x: number;
  /** velocity (m/s) */
  v: number;
  /** acceleration (m/s²) */
  a: number;
  /** |v| (m/s) */
  speed: number;
  /** kinetic energy ½ m v² (J) */
  KE: number;
  /** potential energy ½ m ω² x² (J) */
  PE: number;
  /** total energy ½ m ω² A² (J), constant */
  E: number;
}

export function state(A: number, omega: number, phi: number, t: number, m: number): ShmState {
  const theta = omega * t + phi;
  const x = A * Math.cos(theta);
  const v = -A * omega * Math.sin(theta);
  const a = -omega * omega * x;
  return {
    x,
    v,
    a,
    speed: Math.abs(v),
    KE: 0.5 * m * v * v,
    PE: 0.5 * m * omega * omega * x * x,
    E: 0.5 * m * omega * omega * A * A,
  };
}

/** Period T = 2π/ω (s). */
export function period(omega: number): number {
  return (2 * Math.PI) / omega;
}
