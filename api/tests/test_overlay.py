import pytest

from api.engine.overlay import visual_correction
from api.engine.physics import critical_angle, lens_image, shm_speed, snell


def test_physics_matches_the_frontend_helpers():
    assert snell(1, 1.5, 30) == pytest.approx(19.47, abs=0.01)
    assert snell(1.5, 1, 30) == pytest.approx(48.59, abs=0.01)
    assert snell(1.5, 1, 45) is None and critical_angle(1.5, 1) == pytest.approx(41.81, abs=0.01)
    assert lens_image(-30, 20) == pytest.approx((60, -2))
    assert lens_image(-20, 20) is None
    assert shm_speed(0.1, 10, 0) == pytest.approx(1.0) and shm_speed(0.1, 10, 0.1) == 0


def test_angle_from_surface_overlay_r7():
    o = visual_correction("R7", {"n1": 1.0, "n2": 1.5, "incidence": 30})
    p = o["params"]
    assert (o["visual"], o["overlay"]) == ("refraction", "angle-from-surface")
    assert p["student_incidence"] == 60 and p["refracted"] == pytest.approx(19.5) and p["student_refracted"] == pytest.approx(35.3)
    water = visual_correction("R7", {"n1": 4 / 3, "n2": 1.0, "incidence": 40})["params"]
    assert water["refracted"] == pytest.approx(59.0, abs=0.1) and water["student_refracted"] is None  # student predicts TIR


def test_bends_toward_normal_overlay_r3():
    out = visual_correction("R3", {"n1": 1.5, "n2": 1.0, "incidence": 25})["params"]
    assert out["refracted"] > 25 > out["student_refracted"]  # truth bends away, the idea bends toward
    tir = visual_correction("R3", {"n1": 4 / 3, "n2": 1.0, "incidence": 60})
    assert tir["params"]["refracted"] is None and "totally internally reflected" in tir["caption"]


def test_speed_and_half_lens_overlays():
    s = visual_correction("S4", {"amplitude": 0.1, "omega": 10})["params"]
    true = dict(map(tuple, s["true_speed"]))
    student = dict(map(tuple, s["student_speed"]))
    assert true[0.0] == pytest.approx(1.0) and true[0.1] == 0 and student[0.1] > student[0.0]
    lens = visual_correction("R5", {"u": -30, "f": 20})
    assert lens["params"]["v"] == 60 and lens["params"]["m"] == -2 and "full image" in lens["caption"]


def test_no_overlay_for_other_codes():
    assert visual_correction("S13", None) is None and visual_correction(None, None) is None
