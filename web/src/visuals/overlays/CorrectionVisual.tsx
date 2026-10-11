import type { VisualCorrection } from "../../lib/api";
import { LensOverlay } from "./LensOverlay";
import { RefractionOverlay } from "./RefractionOverlay";
import { SpeedOverlay } from "./SpeedOverlay";

/** "Your idea vs real physics" for a diagnosed misconception. Renders nothing when there is no overlay. */
export function CorrectionVisual({ correction }: { correction: VisualCorrection | null }) {
  if (!correction) return null;
  switch (correction.overlay) {
    case "angle-from-surface":
    case "bends-toward-normal":
      return <RefractionOverlay correction={correction} />;
    case "speed-max-at-extremes":
      return <SpeedOverlay correction={correction} />;
    case "half-lens-half-image":
      return <LensOverlay correction={correction} />;
    default:
      return null;
  }
}
