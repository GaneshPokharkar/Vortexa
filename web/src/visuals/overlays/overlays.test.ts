import { describe, expect, it } from "vitest";
import { lensImage, snell } from "../opticsPhysics";
import { angleFromSurface, arc, bearings, ideaSpeed, polar, trueSpeed } from "./geometry";

describe("overlay geometry", () => {
  it("places bearings like a protractor on screen (0 up, 90 right, 180 down)", () => {
    const up = polar(0, 0, 10, 0);
    const right = polar(0, 0, 10, 90);
    const down = polar(0, 0, 10, 180);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(-10);
    expect(right.x).toBeCloseTo(10);
    expect(down.y).toBeCloseTo(10);
  });

  it("puts the incident source upper-left and the refracted ray lower-right", () => {
    const src = polar(0, 0, 10, bearings.incidentSource(30));
    const out = polar(0, 0, 10, bearings.refracted(20));
    expect(src.x).toBeLessThan(0);
    expect(src.y).toBeLessThan(0);
    expect(out.x).toBeGreaterThan(0);
    expect(out.y).toBeGreaterThan(0);
    expect(arc(0, 0, 5, -30, 0)).toMatch(/A 5 5 0 0 1 /);
  });
});

describe("overlays agree with the server's physics (api/engine/overlay.py)", () => {
  it("R7: measuring from the surface turns 30° into 60° and the 19.5° ray into 35.3°", () => {
    expect(angleFromSurface(30)).toBe(60);
    expect(snell(1, 1.5, 30).refractedDeg).toBeCloseTo(19.47, 1);
    expect(snell(1, 1.5, angleFromSurface(30)).refractedDeg).toBeCloseTo(35.26, 1);
    // water → air, 50° to the surface: the idea predicts TIR, physics gives 59.0°
    expect(snell(4 / 3, 1, angleFromSurface(40)).tir).toBe(true);
    expect(snell(4 / 3, 1, 40).refractedDeg).toBeCloseTo(59.0, 1);
  });

  it("R3: leaving glass the ray bends away; the idea bends it toward the normal", () => {
    const truth = snell(1.5, 1, 25).refractedDeg!;
    const idea = snell(1, 1.5, 25).refractedDeg!;
    expect(truth).toBeGreaterThan(25);
    expect(idea).toBeLessThan(25);
  });

  it("S4: true speed peaks at the mean and is zero at the ends; the idea is the reverse", () => {
    expect(trueSpeed(0.1, 10, 0)).toBeCloseTo(1);
    expect(trueSpeed(0.1, 10, 0.1)).toBe(0);
    expect(ideaSpeed(10, 0.1)).toBeGreaterThan(ideaSpeed(10, 0));
  });

  it("R5: the full image of u = −30 cm, f = 20 cm forms at v = 60 cm, m = −2", () => {
    const img = lensImage(-30, 20);
    expect(img.v).toBeCloseTo(60);
    expect(img.m).toBeCloseTo(-2);
  });
});
