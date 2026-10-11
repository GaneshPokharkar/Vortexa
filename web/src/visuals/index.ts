import type { ComponentType } from "react";
import { LensBench } from "./LensBench";
import { Refraction } from "./Refraction";
import { ShmOscillator } from "./ShmOscillator";

export { LensBench, Refraction, ShmOscillator };
export { CorrectionVisual } from "./overlays/CorrectionVisual";

/** Registry keyed by a card's `visual` id. */
export const VISUALS: Record<string, ComponentType> = {
  "shm-oscillator": ShmOscillator,
  "lens-bench": LensBench,
  refraction: Refraction,
};
