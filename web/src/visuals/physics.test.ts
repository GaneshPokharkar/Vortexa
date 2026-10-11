import { describe, expect, it } from "vitest";
import { lensImage, snell } from "./opticsPhysics";
import { period, state } from "./shmPhysics";

describe("SHM: x = A cos(wt + phi)", () => {
  const A = 0.15;
  const w = 3;
  const phi = 0.4;
  const m = 0.5;
  const T = period(w);

  it("period is 2*pi/omega", () => {
    expect(T).toBeCloseTo((2 * Math.PI) / 3, 12);
  });

  it("at x = 0 the speed is maximum (= A*omega) and a = 0", () => {
    const t = (Math.PI / 2 - phi) / w; // wt + phi = pi/2
    const s = state(A, w, phi, t, m);
    expect(s.x).toBeCloseTo(0, 12);
    expect(s.speed).toBeCloseTo(A * w, 12);
    expect(s.a).toBeCloseTo(0, 12);
  });

  it("at x = +A and x = -A the speed is 0 and |a| = omega^2 * A", () => {
    for (const theta of [0, Math.PI]) {
      const s = state(A, w, phi, (theta - phi) / w, m);
      expect(Math.abs(s.x)).toBeCloseTo(A, 12);
      expect(s.speed).toBeCloseTo(0, 12);
      expect(Math.abs(s.a)).toBeCloseTo(w * w * A, 12);
    }
  });

  it("acceleration always has the opposite sign to x", () => {
    for (let i = 0; i < 50; i++) {
      const s = state(A, w, phi, (i / 50) * 2 * T + 0.0123, m);
      if (Math.abs(s.x) > 1e-12) expect(Math.sign(s.a)).toBe(-Math.sign(s.x));
    }
  });

  it("total energy is constant and KE + PE = E over 20 sample times", () => {
    const E0 = 0.5 * m * w * w * A * A;
    for (let i = 0; i < 20; i++) {
      const s = state(A, w, phi, (i / 20) * 1.7 * T, m);
      expect(s.E).toBeCloseTo(E0, 12);
      expect(s.KE + s.PE).toBeCloseTo(s.E, 12);
    }
  });
});

describe("Thin lens, Cartesian convention", () => {
  it("u = -30, f = 20 -> v = 60, m = -2, real, inverted", () => {
    const r = lensImage(-30, 20);
    expect(r.v).toBeCloseTo(60, 9);
    expect(r.m).toBeCloseTo(-2, 9);
    expect(r.real).toBe(true);
    expect(r.erect).toBe(false);
    expect(r.magnified).toBe(true);
    expect(r.atInfinity).toBe(false);
  });

  it("u = -10, f = 20 -> v = -20, m = 2, virtual, erect", () => {
    const r = lensImage(-10, 20);
    expect(r.v).toBeCloseTo(-20, 9);
    expect(r.m).toBeCloseTo(2, 9);
    expect(r.real).toBe(false);
    expect(r.erect).toBe(true);
    expect(r.magnified).toBe(true);
  });

  it("u = -20, f = 20 -> image at infinity", () => {
    expect(lensImage(-20, 20).atInfinity).toBe(true);
  });

  it("u = -40, f = 20 (object at 2F) -> same size, real, inverted", () => {
    const r = lensImage(-40, 20);
    expect(r.v).toBeCloseTo(40, 9);
    expect(r.m).toBeCloseTo(-1, 9);
    expect(r.magnified).toBe(false);
  });
});

describe("Snell's law", () => {
  it("air -> glass at 30 deg refracts to about 19.47 deg", () => {
    const r = snell(1, 1.5, 30);
    expect(r.tir).toBe(false);
    expect(r.refractedDeg).not.toBeNull();
    expect(r.refractedDeg!).toBeCloseTo(19.47, 2);
    expect(r.criticalDeg).toBeNull();
  });

  it("glass -> air at 30 deg refracts to about 48.59 deg", () => {
    const r = snell(1.5, 1, 30);
    expect(r.tir).toBe(false);
    expect(r.refractedDeg!).toBeCloseTo(48.59, 2);
  });

  it("glass -> air at 45 deg is total internal reflection, critical about 41.81 deg", () => {
    const r = snell(1.5, 1, 45);
    expect(r.tir).toBe(true);
    expect(r.refractedDeg).toBeNull();
    expect(r.criticalDeg!).toBeCloseTo(41.81, 2);
  });

  it("rarer -> denser never gives TIR, even at 80 deg", () => {
    const r = snell(1, 1.5, 80);
    expect(r.tir).toBe(false);
    expect(r.refractedDeg).not.toBeNull();
    for (let th = 0; th <= 89; th++) expect(snell(1, 1.5, th).tir).toBe(false);
  });
});
