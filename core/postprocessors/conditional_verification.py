import base64
import os
from io import BytesIO
from tempfile import NamedTemporaryFile

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import cartopy.crs as ccrs
import cartopy.feature as cfeature
import numpy as np


def _scatter_map(lons, lats, values, bins, colors, title_lines, code):
    """Create a scatter plot on a map and return a base64 PNG."""
    norm = mcolors.BoundaryNorm(bins, len(colors))
    cmap = mcolors.ListedColormap(colors)

    fig, ax = plt.subplots(
        figsize=(10, 6), subplot_kw={"projection": ccrs.Mollweide()}
    )
    ax.set_global()
    ax.add_feature(cfeature.COASTLINE, linewidth=1, edgecolor="#333333")
    ax.add_feature(cfeature.BORDERS, linewidth=0.5, edgecolor="#666666")

    sc = ax.scatter(
        lons, lats, c=values, cmap=cmap, norm=norm,
        s=1, marker="o", transform=ccrs.PlateCarree(),
    )

    cbar = plt.colorbar(sc, ax=ax, orientation="horizontal", pad=0.05, shrink=0.7)
    cbar.ax.tick_params(labelsize=7)

    ax.set_title("\n".join(title_lines), fontsize=10)

    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return {"image": base64.b64encode(buf.read()).decode("utf-8")}


def plot_obs_freq(predictor_matrix, code):
    df = predictor_matrix[["LonOBS", "LatOBS", "OBS"]]
    grouped_df = df.groupby(["LatOBS", "LonOBS"], as_index=False).count()

    bins = [1, 2, 5, 10, 15, 20, 25, 30, 100000]
    colors = [
        (0.702, 0.702, 0.702),
        (0.404, 0.404, 0.404),
        "blue",
        (0.498, 1.0, 0.0),
        (1.0, 0.855, 0.0),
        "orange",
        "red",
        "magenta",
    ]

    return _scatter_map(
        grouped_df["LonOBS"].to_numpy(dtype=np.float64),
        grouped_df["LatOBS"].to_numpy(dtype=np.float64),
        grouped_df["OBS"].to_numpy(dtype=np.float64),
        bins, colors,
        ["OBS Frequency", f"WT Code = {code}"],
        code,
    )


def plot_avg(predictor_matrix, code):
    error = "FER" if "FER" in predictor_matrix.columns else "FE"

    df = predictor_matrix[["LonOBS", "LatOBS", error]]
    grouped_df = df.groupby(["LatOBS", "LonOBS"])[error].mean().reset_index()

    bins = [-1, -0.25, 0.25, 2, 1000]
    colors = [
        (0.0, 0.549, 0.188),
        "black",
        (1.0, 0.690, 0.0),
        "red",
    ]

    return _scatter_map(
        grouped_df["LonOBS"].to_numpy(dtype=np.float64),
        grouped_df["LatOBS"].to_numpy(dtype=np.float64),
        grouped_df[error].to_numpy(dtype=np.float64),
        bins, colors,
        [f"{error} Mean", f"WT Code = {code}"],
        code,
    )


def plot_std(predictor_matrix, code):
    error = "FER" if "FER" in predictor_matrix.columns else "FE"

    df = predictor_matrix[["LonOBS", "LatOBS", error]]
    grouped_df = df.groupby(["LatOBS", "LonOBS"])[error].std().reset_index()

    bins = [0, 0.0001, 0.5, 1, 2, 5, 1000]
    colors = [
        (0.702, 0.702, 0.702),
        (0.297, 0.297, 0.950),
        (0.152, 0.656, 0.597),
        (1.0, 0.690, 0.0),
        "red",
        (1.0, 0.0, 1.0),
    ]

    return _scatter_map(
        grouped_df["LonOBS"].to_numpy(dtype=np.float64),
        grouped_df["LatOBS"].to_numpy(dtype=np.float64),
        grouped_df[error].to_numpy(dtype=np.float64),
        bins, colors,
        [f"{error} Standard Deviation", f"WT Code = {code}"],
        code,
    )
