import { describe, expect, it } from "vitest";
import { HEADLINE } from "../lib/groups";
import { SPEECH_LINES } from "./speechLines";

// The audio was recorded from these exact words; the app hides a clip whose text has changed (see `recorded`).
// This flags it so the clip gets re-recorded instead of silently disappearing.
describe("pre-recorded speech", () => {
  it("has a current clip for every feedback headline", () => {
    for (const [category, text] of Object.entries(HEADLINE)) {
      expect(SPEECH_LINES[`result-${category}` as keyof typeof SPEECH_LINES]?.en, category).toBe(text);
    }
  });

  it("has an English and a Marathi line for every clip", () => {
    for (const [id, l] of Object.entries(SPEECH_LINES)) expect(l.en && l.mr, id).toBeTruthy();
  });
});
