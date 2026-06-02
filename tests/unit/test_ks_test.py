import matplotlib

matplotlib.use("Agg")

import pandas as pd

from core.postprocessors.ks_test import (
    format_ks_stats,
    ks_test_engine,
    plot_ks_stats,
)


def _frame():
    return pd.DataFrame(
        {
            "predictor": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10.0],
            "error": [0.5, -0.2, 0.1, 0.9, -0.5, 0.3, -0.1, 0.7, -0.8, 0.2],
        }
    )


def test_ks_test_engine_returns_expected_breakpoints_and_count():
    result, count = ks_test_engine(_frame(), "predictor", "error", breakpoints_num=3)

    assert count == 10
    assert list(result.columns) == ["breakpoint", "pValue", "dStatValue"]
    # linspace(0, 9, 5)[1:-1] -> indices 2, 4, 7 -> sorted predictor values 3, 5, 8
    assert result["breakpoint"].tolist() == [3.0, 5.0, 8.0]
    # pValue is -ln(p) so it is non-negative; the KS D-statistic lives in [0, 1]
    assert (result["pValue"] >= 0).all()
    assert ((result["dStatValue"] >= 0) & (result["dStatValue"] <= 1)).all()


def test_ks_test_engine_respects_lower_and_upper_bounds():
    _, count = ks_test_engine(
        _frame(), "predictor", "error", breakpoints_num=2, lower_bound=3, upper_bound=7
    )
    # predictor restricted to [3, 7] -> 3, 4, 5, 6, 7 -> five rows feed the test
    assert count == 5


def test_format_ks_stats_renders_every_column_to_four_decimals():
    df = pd.DataFrame({"breakpoint": [3.0], "pValue": [1.23456], "dStatValue": [0.5]})

    out = format_ks_stats(df)

    assert out["breakpoint"].tolist() == ["3.0000"]
    assert out["pValue"].tolist() == ["1.2346"]
    assert out["dStatValue"].tolist() == ["0.5000"]


def test_plot_ks_stats_returns_a_base64_png():
    df, _ = ks_test_engine(_frame(), "predictor", "error", breakpoints_num=3)

    img = plot_ks_stats(df, node="11000", predictor="CPR", unit="-")

    assert isinstance(img, str) and len(img) > 100
