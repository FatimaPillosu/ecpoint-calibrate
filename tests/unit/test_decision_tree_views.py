"""Coverage for the decision-tree paths the regression suite does not exercise:
the lazy/expandable tree views, representative-error computation, title tokens,
the single-pass and legacy evaluators, and the histogram/map rendering helpers.

These complement (do not replace) tests/unit/test_decision_tree.py, which guards
the WT-code and observation-binning invariants.
"""
import matplotlib

matplotlib.use("Agg")

import pandas as pd
import pytest

from core.loaders import ErrorType
from core.postprocessors.decision_tree import (
    DecisionTree,
    WeatherType,
    human_format,
)

inf = float("inf")


@pytest.fixture
def dt():
    """A 2-predictor tree: A has 2 bins, B has 3 bins -> 6 weather types.

    Rows are in Cartesian (sorted-low) order so WT index i maps cleanly:
        0:A1B1 1:A1B2 2:A1B3 3:A2B1 4:A2B2 5:A2B3
    """
    low = pd.DataFrame(
        {
            "A_thrL": [-inf, -inf, -inf, 0.25, 0.25, 0.25],
            "B_thrL": [-inf, 70.0, 275.0, -inf, 70.0, 275.0],
        }
    )
    high = pd.DataFrame(
        {
            "A_thrH": [0.25, 0.25, 0.25, inf, inf, inf],
            "B_thrH": [70.0, 275.0, inf, 70.0, 275.0, inf],
        }
    )
    return DecisionTree(
        threshold_low=low,
        threshold_high=high,
        ranges={"A": ["-inf", "inf"], "B": ["-inf", "inf"]},
    )


class _FakeLoader:
    """BasePointDataReader stand-in with cheaper=False (reads .dataframe directly)."""

    def __init__(self, dataframe, error_type=ErrorType.FER):
        self.dataframe = dataframe
        self.cheaper = False
        self.error_type = error_type


class _CheaperLoader:
    """cheaper=True stand-in that serves columns through select()."""

    def __init__(self, dataframe, error_type=ErrorType.FER):
        self.dataframe = dataframe
        self.cheaper = True
        self.error_type = error_type

    def select(self, *cols, series=True):
        if series:
            return self.dataframe[cols[0]]
        return self.dataframe[list(cols)]


# --- tree_lazy --------------------------------------------------------------


def test_tree_lazy_full_depth_builds_every_leaf(dt):
    root = dt.tree_lazy(max_depth=3).json

    assert [c["meta"]["code"] for c in root["children"]] == ["10", "20"]

    a1 = root["children"][0]
    assert [c["meta"]["code"] for c in a1["children"]] == ["11", "12", "13"]
    assert [c["meta"]["idxWT"] for c in a1["children"]] == [0, 1, 2]
    for leaf in a1["children"]:
        assert leaf["children"] == []
        assert "_collapsed" not in leaf["meta"]


def test_tree_lazy_collapses_nodes_at_the_depth_boundary(dt):
    root = dt.tree_lazy(max_depth=1).json

    assert len(root["children"]) == 2
    a1, a2 = root["children"]

    assert a1["meta"]["code"] == "10"
    assert a1["meta"]["_collapsed"] is True
    assert a1["meta"]["_childCount"] == 3
    assert (a1["meta"]["_wtFrom"], a1["meta"]["_wtTo"]) == (0, 2)
    assert (a2["meta"]["_wtFrom"], a2["meta"]["_wtTo"]) == (3, 5)


def test_tree_lazy_skips_a_fully_unbounded_predictor():
    low = pd.DataFrame({"A_thrL": [-inf, -inf], "B_thrL": [-inf, 5.0]})
    high = pd.DataFrame({"A_thrH": [inf, inf], "B_thrH": [5.0, inf]})
    dt = DecisionTree(
        threshold_low=low,
        threshold_high=high,
        ranges={"A": ["-inf", "inf"], "B": ["-inf", "inf"]},
    )

    root = dt.tree_lazy(max_depth=3).json

    # A is unbounded for every WT, so its level is skipped and B surfaces at root
    assert [c["meta"]["predictor"] for c in root["children"]] == ["B", "B"]


# --- expand_node ------------------------------------------------------------


def test_expand_node_rebuilds_children_with_original_wt_offsets(dt):
    first = dt.expand_node(wt_from=0, wt_to=2, max_depth=3, node_level=0, node_code="10")
    assert [c["meta"]["code"] for c in first] == ["11", "12", "13"]
    assert [c["meta"]["idxWT"] for c in first] == [0, 1, 2]

    # The second group must carry its original (non-zero) offset back through _fix_idx
    second = dt.expand_node(wt_from=3, wt_to=5, max_depth=3, node_level=0, node_code="20")
    assert [c["meta"]["code"] for c in second] == ["21", "22", "23"]
    assert [c["meta"]["idxWT"] for c in second] == [3, 4, 5]


# --- cal_rep_error ----------------------------------------------------------


def test_cal_rep_error_indexes_by_leaf_code_and_fills_empty_wts(dt):
    loader = _FakeLoader(
        pd.DataFrame({"A": [0.1, 0.5], "B": [10.0, 300.0], "FER": [0.5, 0.9]})
    )

    result = dt.cal_rep_error(loader, nBin=3)

    assert list(result.index) == ["11", "12", "13", "21", "22", "23"]
    assert result.shape == (6, 3)
    # obs 0 (A=0.1, B=10) -> WT "11"; obs 1 (A=0.5, B=300) -> WT "23"
    assert result.loc["11"].tolist() == [0.5, 0.5, 0.5]
    assert result.loc["23"].tolist() == [0.9, 0.9, 0.9]
    # a WT with no matching observation keeps its -1 sentinel row
    assert result.loc["12"].tolist() == [-1.0, -1.0, -1.0]


# --- wt_title_tokens --------------------------------------------------------


def test_wt_title_tokens_formats_each_predictor_band(dt):
    assert dt.wt_title_tokens(0) == ("(-inf <= A < 0.25)", "(-inf <= B < 70)")
    assert dt.wt_title_tokens(5) == ("(0.25 <= A < inf)", "(275 <= B < inf)")


# --- evaluate_all branches --------------------------------------------------


def test_evaluate_all_wraps_periodic_predictor_to_last_bin():
    # LST 21->3 is the periodic wrap bin (thrL > thrH); values 1 and 22 fall in it
    low = pd.DataFrame({"LST_thrL": [3.0, 9.0, 15.0, 21.0]})
    high = pd.DataFrame({"LST_thrH": [9.0, 15.0, 21.0, 3.0]})
    dt = DecisionTree(
        threshold_low=low, threshold_high=high, ranges={"LST": ["0", "24"]}
    )
    loader = _FakeLoader(
        pd.DataFrame({"LST": [1.0, 5.0, 22.0, 10.0], "OBS": [10, 20, 30, 40]})
    )

    wt_indices, _ = dt.evaluate_all(loader, "OBS")

    assert wt_indices.tolist() == [3, 0, 3, 1]


def test_evaluate_all_reads_through_a_cheaper_loader():
    low = pd.DataFrame({"A_thrL": [-inf, 0.25]})
    high = pd.DataFrame({"A_thrH": [0.25, inf]})
    dt = DecisionTree(
        threshold_low=low, threshold_high=high, ranges={"A": ["-inf", "inf"]}
    )
    loader = _CheaperLoader(pd.DataFrame({"A": [0.1, 0.5], "OBS": [1, 2]}))

    wt_indices, _ = dt.evaluate_all(loader, "OBS")

    assert wt_indices.tolist() == [0, 1]


# --- WeatherType.evaluate (cheaper) and legacy _evaluate --------------------


def test_weathertype_evaluate_supports_a_cheaper_loader():
    df = pd.DataFrame({"A": [0.1, 0.3, 0.5, 0.9], "OBS": [1, 2, 3, 4]})
    labels = ["A_thrL", "A_thrH"]
    series = pd.Series(dict(zip(labels, [0.25, inf])))
    wt = WeatherType(
        thrL=series.iloc[::2],
        thrH=series.iloc[1::2],
        thrL_labels=labels[::2],
        thrH_labels=labels[1::2],
    )

    out, _ = wt.evaluate("OBS", loader=_CheaperLoader(df))

    assert sorted(out["OBS"].tolist()) == [2, 3, 4]  # A >= 0.25


def test_weathertype_legacy_evaluate_filters_and_builds_title():
    labels = ["A_thrL", "A_thrH", "B_thrL", "B_thrH"]
    series = pd.Series(dict(zip(labels, [0.25, inf, 70.0, 275.0])))
    wt = WeatherType(
        thrL=series.iloc[::2],
        thrH=series.iloc[1::2],
        thrL_labels=labels[::2],
        thrH_labels=labels[1::2],
    )
    pm = pd.DataFrame(
        {"A": [0.1, 0.3, 0.5, 0.9], "B": [100, 200, 300, 80], "FER": [1, 2, 3, 4]}
    )

    error_list, matrix, title = wt._evaluate(pm)

    # A in [0.25, inf) keeps rows 1,2,3; then B in [70, 275) keeps rows 1,3
    assert error_list == [2, 4]
    assert matrix["A"].tolist() == [0.3, 0.9]
    assert "A" in title and "B" in title


# --- discretize_error edge, human_format, palette ---------------------------


def test_discretize_error_handles_last_bin_overflow():
    out = WeatherType.discretize_error(pd.Series([0.0, 1.0, 2.0, 3.0]), num_bins=3)
    assert out.round(3).tolist() == [0.667, 2.0, 3.0]


def test_human_format_scales_and_trims_trailing_zeros():
    assert human_format(500) == "500"
    assert human_format(1500) == "1.50K"
    assert human_format(2_000_000) == "2M"
    assert human_format(0) == "0"


def test_leaf_colors_extends_palette_beyond_ten_predictors():
    low = pd.DataFrame({f"P{i}_thrL": [-inf] for i in range(11)})
    high = pd.DataFrame({f"P{i}_thrH": [inf] for i in range(11)})
    dt = DecisionTree(
        threshold_low=low,
        threshold_high=high,
        ranges={f"P{i}": ["-inf", "inf"] for i in range(11)},
    )

    colors = dt.leaf_colors

    assert len(colors) == 12  # 10 base + 1 extended + black
    assert all(isinstance(c, str) and c.startswith("#") for c in colors)


# --- histogram and map rendering --------------------------------------------


def _single_predictor_wt(error_type):
    labels = ["A_thrL", "A_thrH"]
    series = pd.Series(dict(zip(labels, [0.25, inf])))
    return WeatherType(
        thrL=series.iloc[::2],
        thrH=series.iloc[1::2],
        thrL_labels=labels[::2],
        thrH_labels=labels[1::2],
        error_type=error_type,
    )


def test_weathertype_plot_renders_fer_histogram_to_base64():
    wt = _single_predictor_wt(ErrorType.FER)
    data = pd.Series([-0.99, -0.5, -0.1, 0.0, 0.3, 0.5, 1.0, 2.5, 3.0, 7.0])

    img = wt.plot(
        data=data,
        bins=WeatherType.DEFAULT_FER_BINS,
        title="11000",
        y_lim=100,
        num_bins=10,
    )

    assert isinstance(img, str) and len(img) > 100


def test_weathertype_plot_renders_fe_histogram_to_base64():
    wt = _single_predictor_wt(ErrorType.FE)
    bins = [-1000, -5, -2, -1, -0.5, 0.5, 1, 2, 5, 1000]
    data = pd.Series([-100, -3, -1.5, -0.7, 0.0, 0.7, 1.5, 3.0, 50.0, -0.2])

    img = wt.plot(data=data, bins=bins, title="FE WT", y_lim=100, num_bins=8)

    assert isinstance(img, str) and len(img) > 100


def test_weathertype_plot_maps_dispatches_by_mode():
    wt = _single_predictor_wt(ErrorType.FER)
    matrix = pd.DataFrame(
        {
            "LonOBS": [0.0, 0.0, 10.0, 10.0],
            "LatOBS": [0.0, 0.0, 10.0, 10.0],
            "OBS": [1.0, 2.0, 3.0, 4.0],
            "FER": [0.1, 0.2, -0.3, 0.5],
        }
    )

    for mode in ("a", "b", "c"):
        out = wt.plot_maps(matrix, code="10000", mode=mode)
        assert "image" in out and len(out["image"]) > 100
