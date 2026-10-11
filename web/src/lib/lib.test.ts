import { describe, expect, it } from "vitest";
import { CATEGORY, glow } from "./meta";
import { nodePoints, segment } from "./path";

describe("category meta", () => {
  it("has a label, line and tone for every engine category", () => {
    const all = ["SCIENTIFIC", "FRAGILE", "FALSE_POSITIVE", "MISCONCEPTION", "LACK_OF_KNOWLEDGE",
      "SLIP", "COMPUTATIONAL_SLIP", "AMBIGUOUS", "UNDIAGNOSED"] as const;
    for (const c of all) expect(CATEGORY[c].label.length).toBeGreaterThan(0);
    expect(Object.keys(CATEGORY).sort()).toEqual([...all].sort());
  });

  it("never shows a wrong-reason answer in the success colour", () => {
    expect(CATEGORY.FALSE_POSITIVE.tone).not.toBe("green");
  });
});

describe("glow", () => {
  it("grows with P(L) and clamps outside [0, 1]", () => {
    expect(glow(0.9).blur).toBeGreaterThan(glow(0.3).blur);
    expect(glow(-1)).toEqual(glow(0));
    expect(glow(2)).toEqual(glow(1));
  });
});

describe("path", () => {
  it("places 9 nodes alternating crest and trough, left to right", () => {
    const pts = nodePoints();
    expect(pts).toHaveLength(9);
    for (let i = 1; i < 9; i++) {
      expect(pts[i].x).toBeGreaterThan(pts[i - 1].x);
      expect(Math.sign(pts[i].y - 160)).toBe(-Math.sign(pts[i - 1].y - 160));
    }
  });

  it("joins segments exactly at the nodes, wave or ray", () => {
    const [a, b] = nodePoints();
    for (const straight of [true, false]) {
      const d = segment(a, b, straight);
      expect(d.startsWith(`M${a.x.toFixed(straight ? 0 : 1)}`) || d.startsWith(`M${a.x}`)).toBe(true);
      expect(d.endsWith(`${b.y.toFixed(1)}`) || d.endsWith(`${b.y}`)).toBe(true);
    }
  });
});
