import { CorrectionVisual } from "../visuals";
import { SAMPLE_CORRECTIONS } from "./overlaySamples";

/** Development-only preview of the four "your idea vs physics" overlays (not routed in production builds). */
export default function DevOverlays() {
  return (
    <div className="grid gap-8 py-8 lg:grid-cols-2">
      {Object.entries(SAMPLE_CORRECTIONS).map(([code, c]) => (
        <div key={code}>
          <h2 className="mb-2 text-[17px] font-semibold">{code}: {c.overlay}</h2>
          <CorrectionVisual correction={c} />
        </div>
      ))}
    </div>
  );
}
