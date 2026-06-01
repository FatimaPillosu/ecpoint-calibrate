import base64
from io import BytesIO

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import matplotlib.cm as cm
import cartopy.crs as ccrs
import numpy as np
import earthkit.maps as ekm


def _scatter_map(lons, lats, values, bins, colors, title_lines, code):
    """Draw the observation points on an earthkit-maps global chart and return a base64 PNG."""
    norm = mcolors.BoundaryNorm(bins, len(colors))
    cmap = mcolors.ListedColormap(colors)
    style = ekm.Style(colors=colors, levels=bins, normalize=False)

    chart = ekm.Chart(crs=ccrs.Mollweide())
    chart.scatter(values, x=lons, y=lats, style=style, s=1)
    chart.coastlines(linewidth=1, color="#333333")
    chart.borders(linewidth=0.5, color="#666666")

    geo_ax = chart.fig.get_axes()[0]
    geo_ax.set_global()

    # earthkit-maps' own legend() expects xarray-style metadata, so build the
    # binned colorbar directly from the same levels/colors the style uses.
    mappable = cm.ScalarMappable(norm=norm, cmap=cmap)
    mappable.set_array([])
    cbar = chart.fig.colorbar(
        mappable, ax=geo_ax, orientation="horizontal", pad=0.05, shrink=0.7
    )
    cbar.ax.tick_params(labelsize=7)

    chart.title("\n".join(title_lines))

    buf = BytesIO()
    chart.fig.savefig(buf, format="png", bbox_inches="tight", dpi=150)
    plt.close(chart.fig)
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
