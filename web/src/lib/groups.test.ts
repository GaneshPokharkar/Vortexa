import { describe, expect, it } from "vitest";
import { GROUP_LABEL } from "./api";
import { GROUPS, STATUS, confidenceWords, groupOf, pct } from "./groups";

describe("answer groups", () => {
  it("map every engine category to one of the six groups, matching the server labels", () => {
    const all = ["SCIENTIFIC", "FRAGILE", "PARTIAL", "FALSE_POSITIVE", "MISCONCEPTION", "LACK_OF_KNOWLEDGE",
      "SLIP", "COMPUTATIONAL_SLIP", "AMBIGUOUS", "OFF_TOPIC", "UNDIAGNOSED"] as const;
    for (const c of all) expect(GROUPS[groupOf(c)]).toBeDefined();
    for (const g of ["A", "B", "C", "D", "E", "F"] as const) expect(GROUP_LABEL[g].length).toBeGreaterThan(0);
    expect(groupOf("FALSE_POSITIVE")).toBe("B"); // right answer, wrong reason is never shown as correct
  });

  it("orders mastery statuses and never shows confidence as a probability", () => {
    expect(STATUS.demonstrated.step).toBeGreaterThan(STATUS.developing.step);
    expect(confidenceWords(0.9)).not.toMatch(/%/);
    expect(confidenceWords(null)).toBeNull();
    expect(pct(0.996)).toBe("99%");
  });
});
