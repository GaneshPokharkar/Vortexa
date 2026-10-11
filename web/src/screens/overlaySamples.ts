// Generated from api/engine/overlay.py for the dev preview only.
import type { VisualCorrection } from "../lib/api";

export const SAMPLE_CORRECTIONS: Record<string, VisualCorrection> = {
  "R7": {
    "visual": "refraction",
    "overlay": "angle-from-surface",
    "params": {
      "n1": 1.3333333333333333,
      "n2": 1.0,
      "incidence": 40.0,
      "student_incidence": 50.0,
      "refracted": 59.0,
      "student_refracted": null,
      "critical": 48.6
    },
    "student_label": "Your idea: incidence 50° (measured from the surface)",
    "true_label": "Physics: incidence 40° (measured from the normal)",
    "caption": "Angles are measured from the normal. Using 50° instead of 40° predicts total internal reflection, but the real ray leaves at 59.0°."
  },
  "R3": {
    "visual": "refraction",
    "overlay": "bends-toward-normal",
    "params": {
      "n1": 1.5,
      "n2": 1.0,
      "incidence": 25.0,
      "refracted": 39.3,
      "student_refracted": 16.4,
      "critical": 41.8
    },
    "student_label": "Your idea: the ray always bends toward the normal",
    "true_label": "Physics: n₁ sin i = n₂ sin r",
    "caption": "Going into a rarer medium the ray bends away from the normal: 39.3°, not 16.4°."
  },
  "S4": {
    "visual": "shm-oscillator",
    "overlay": "speed-max-at-extremes",
    "params": {
      "amplitude": 0.1,
      "omega": 10.0,
      "max_speed": 1.0
    },
    "student_label": "Your idea: fastest at the ends",
    "true_label": "Physics: |v| = ω√(A² − x²), fastest at the mean",
    "caption": "The block stops at x = ±0.1 m to turn back, so its speed there is 0. It is fastest, 1.00 m/s, as it passes the mean position."
  },
  "R5": {
    "visual": "lens-bench",
    "overlay": "half-lens-half-image",
    "params": {
      "u": -30.0,
      "f": 20.0,
      "v": 60.0,
      "m": -2.0,
      "covered": "top"
    },
    "student_label": "Your idea: only half the image remains",
    "true_label": "Physics: the whole image forms, about half as bright",
    "caption": "Every point of the object sends rays through the uncovered half too, so the full image still forms at v = 60 cm, only dimmer."
  }
};
