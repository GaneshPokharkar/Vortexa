"""Stage 3 of the orchestrator: the visual-correction agent.

Given a diagnosed misconception and the question's physical setup, it chooses which visual to show and computes,
with exact physics, both the true result and what the student's idea would predict. The browser draws the
student's version as a dashed "your idea" layer over the real one. No language model touches these numbers.
"""
from __future__ import annotations

from typing import Optional

from api.engine.physics import critical_angle, lens_image, shm_speed, snell

OVERLAY_CODES = {"R7", "R3", "S4", "R5"}

# Defaults when a question has no numeric setup of its own.
DEFAULTS = {
    "refraction": {"n1": 1.0, "n2": 1.5, "incidence": 30.0},
    "shm": {"amplitude": 0.1, "omega": 3.14159},
    "lens": {"u": -30.0, "f": 20.0},
}


def _r(x: Optional[float], d: int = 1) -> Optional[float]:
    return None if x is None else round(x, d)


def visual_correction(code: Optional[str], setup: Optional[dict]) -> Optional[dict]:
    """Overlay spec for the browser, or None when this misconception has no overlay."""
    if code not in OVERLAY_CODES:
        return None
    s = dict(setup or {})

    if code == "R7":  # angle measured from the surface instead of the normal
        p = {**DEFAULTS["refraction"], **s}
        true_i = p["incidence"]
        student_i = 90.0 - true_i
        true_r, student_r = snell(p["n1"], p["n2"], true_i), snell(p["n1"], p["n2"], student_i)
        student_says = "predicts total internal reflection" if student_r is None else f"sends the ray out at {student_r:.1f}°"
        truth = "the real ray is totally internally reflected" if true_r is None else f"the real ray leaves at {true_r:.1f}°"
        return {
            "visual": "refraction", "overlay": "angle-from-surface",
            "params": {"n1": p["n1"], "n2": p["n2"], "incidence": _r(true_i), "student_incidence": _r(student_i),
                       "refracted": _r(true_r), "student_refracted": _r(student_r),
                       "critical": _r(critical_angle(p["n1"], p["n2"]))},
            "student_label": f"Your idea: incidence {student_i:.0f}° (measured from the surface)",
            "true_label": f"Physics: incidence {true_i:.0f}° (measured from the normal)",
            "caption": f"Angles are measured from the normal. Using {student_i:.0f}° instead of {true_i:.0f}° {student_says}, but {truth}.",
        }

    if code == "R3":  # light always bends toward the normal
        p = {**DEFAULTS["refraction"], **s}
        n1, n2, i = p["n1"], p["n2"], p["incidence"]
        true_r = snell(n1, n2, i)
        # The student's picture: always toward the normal, i.e. sin r = (n_small / n_big) sin i.
        student_r = snell(min(n1, n2), max(n1, n2), i)
        if n2 > n1:
            caption = f"Going into a denser medium the ray does bend toward the normal ({true_r:.1f}°). Leaving it, it bends away."
        elif true_r is None:
            caption = (f"Going into a rarer medium beyond the critical angle ({critical_angle(n1, n2):.1f}°) the ray is totally "
                       f"internally reflected; it does not bend toward the normal to {student_r:.1f}°.")
        else:
            caption = f"Going into a rarer medium the ray bends away from the normal: {true_r:.1f}°, not {student_r:.1f}°."
        return {
            "visual": "refraction", "overlay": "bends-toward-normal",
            "params": {"n1": n1, "n2": n2, "incidence": _r(i), "refracted": _r(true_r), "student_refracted": _r(student_r),
                       "critical": _r(critical_angle(n1, n2))},
            "student_label": "Your idea: the ray always bends toward the normal",
            "true_label": "Physics: n₁ sin i = n₂ sin r",
            "caption": caption,
        }

    if code == "S4":  # speed is maximum at the extremes
        p = {**DEFAULTS["shm"], **s}
        a, w = p["amplitude"], p["omega"]
        samples = [round(-a + 2 * a * k / 20, 5) for k in range(21)]
        return {
            "visual": "shm-oscillator", "overlay": "speed-max-at-extremes",
            "params": {"amplitude": a, "omega": w,
                       "true_speed": [[x, round(shm_speed(a, w, x), 4)] for x in samples],
                       # The student's picture: speed grows with distance from the mean, peaking at the ends.
                       "student_speed": [[x, round(w * abs(x), 4)] for x in samples],
                       "max_speed": round(a * w, 4)},
            "student_label": "Your idea: fastest at the ends",
            "true_label": "Physics: |v| = ω√(A² − x²), fastest at the mean",
            "caption": (f"The block stops at x = ±{a:g} m to turn back, so its speed there is 0. "
                        f"It is fastest, {a * w:.2f} m/s, as it passes the mean position."),
        }

    p = {**DEFAULTS["lens"], **s}  # R5: covering half the lens removes half the image
    img = lens_image(p["u"], p["f"])
    v, m = img if img else (None, None)
    return {
        "visual": "lens-bench", "overlay": "half-lens-half-image",
        "params": {"u": p["u"], "f": p["f"], "v": _r(v), "m": _r(m, 2), "covered": "top"},
        "student_label": "Your idea: only half the image remains",
        "true_label": "Physics: the whole image forms, about half as bright",
        "caption": ("Every point of the object sends rays through the uncovered half too, so the full image still "
                    + (f"forms at v = {v:.0f} cm" if v is not None else "forms") + ", only dimmer."),
    }
