"""Exact physics used by the visual-correction stage. Pure functions; same conventions as web/src/visuals.

Optics uses the Cartesian sign convention (light left to right, real object u < 0, convex f > 0).
SHM uses x = A cos(ωt + φ).
"""
from __future__ import annotations

import math
from typing import Optional


def snell(n1: float, n2: float, incidence_deg: float) -> Optional[float]:
    """Refraction angle in degrees from n1 sin i = n2 sin r, or None for total internal reflection."""
    s = n1 * math.sin(math.radians(incidence_deg)) / n2
    return None if s > 1 else math.degrees(math.asin(s))


def critical_angle(n1: float, n2: float) -> Optional[float]:
    return math.degrees(math.asin(n2 / n1)) if n1 > n2 else None


def lens_image(u: float, f: float) -> Optional[tuple[float, float]]:
    """(v, m) from 1/v − 1/u = 1/f and m = v/u; None when the image is at infinity (u = −f)."""
    inv = 1 / f + 1 / u
    if abs(inv) < 1e-12:
        return None
    v = 1 / inv
    return v, v / u


def shm_speed(amplitude: float, omega: float, x: float) -> float:
    """|v| = ω√(A² − x²): largest at the mean, zero at the extremes."""
    return omega * math.sqrt(max(amplitude * amplitude - x * x, 0.0))
