import pandas as pd

from core.api import evaluate_wts_direct, is_full_range

inf = float("inf")


class _FakeLoader:
    """Minimal loader stand-in exposing the .dataframe evaluate_wts_direct reads."""

    def __init__(self, dataframe):
        self.dataframe = dataframe
        self.cheaper = False
        self.error_type = None


def test_is_full_range_detects_infinite_span():
    assert is_full_range(-inf, inf) is True


def test_is_full_range_detects_a_circular_predictor_at_its_field_range():
    # A circular predictor (e.g. Local Solar Time) spanning its whole 0..24
    # field range is effectively unbounded.
    assert is_full_range(0.0, 24.0, "LST", {"LST": ["0", "24"]}) is True
    # A genuine sub-range of that field is not full.
    assert is_full_range(6.0, 18.0, "LST", {"LST": ["0", "24"]}) is False


def test_is_full_range_handles_partial_and_non_numeric_ranges():
    assert is_full_range(0.25, inf) is False
    # Non-numeric field bounds raise ValueError internally and fall through to False.
    assert is_full_range(0.0, 24.0, "LST", {"LST": ["x", "y"]}) is False


def test_evaluate_wts_direct_assigns_each_observation_to_its_weather_type():
    thrL = pd.DataFrame({"A_thrL": [-inf, 0.5]})
    thrH = pd.DataFrame({"A_thrH": [0.5, inf]})
    loader = _FakeLoader(pd.DataFrame({"A": [0.1, 0.9, 0.3], "OBS": [1, 2, 3]}))

    wt_indices, errors = evaluate_wts_direct(thrL, thrH, loader, "OBS")

    # 0.1 and 0.3 fall in WT0 ([-inf, 0.5)); 0.9 falls in WT1 ([0.5, inf)).
    assert wt_indices.tolist() == [0, 1, 0]
    assert errors.tolist() == [1, 2, 3]


def test_evaluate_wts_direct_skips_full_range_and_absent_predictors():
    # Predictor A is full-range (matches everything); predictor B is missing
    # from the loader dataframe and must be skipped rather than crash.
    thrL = pd.DataFrame({"A_thrL": [-inf], "B_thrL": [0.0]})
    thrH = pd.DataFrame({"A_thrH": [inf], "B_thrH": [10.0]})
    loader = _FakeLoader(pd.DataFrame({"A": [1.0, 2.0], "OBS": [7, 8]}))

    wt_indices, _ = evaluate_wts_direct(thrL, thrH, loader, "OBS")

    assert wt_indices.tolist() == [0, 0]
