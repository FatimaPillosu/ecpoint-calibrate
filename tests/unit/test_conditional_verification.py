import matplotlib

matplotlib.use("Agg")

import pandas as pd

from core.postprocessors.conditional_verification import (
    plot_avg,
    plot_obs_freq,
    plot_std,
)


def _predictor_matrix():
    # Three distinct grid points, each observed twice, so groupby mean/std are
    # well-defined (no single-element NaN groups).
    return pd.DataFrame(
        {
            "LonOBS": [0.0, 0.0, 10.0, 10.0, 20.0, 20.0],
            "LatOBS": [0.0, 0.0, 10.0, 10.0, 20.0, 20.0],
            "OBS": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0],
            "FER": [0.1, 0.2, -0.3, 0.5, 1.0, -0.2],
        }
    )


def test_plot_obs_freq_returns_a_base64_image():
    out = plot_obs_freq(_predictor_matrix(), code="10000")
    assert "image" in out and len(out["image"]) > 100


def test_plot_avg_returns_a_base64_image():
    out = plot_avg(_predictor_matrix(), code="10000")
    assert "image" in out and len(out["image"]) > 100


def test_plot_std_returns_a_base64_image():
    out = plot_std(_predictor_matrix(), code="10000")
    assert "image" in out and len(out["image"]) > 100
