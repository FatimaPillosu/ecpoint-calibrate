import json
import os
import traceback

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenv not installed — read .env manually
    _env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.isfile(_env_path):
        with open(_env_path) as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    os.environ.setdefault(_k.strip(), _v.strip())
from datetime import datetime
from functools import lru_cache
from io import StringIO
from pathlib import Path
from textwrap import dedent

import pandas
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from healthcheck import EnvironmentDump, HealthCheck

from core.loaders import geopoints as geopoints_loader
from core.loaders import load_point_data_by_path
from core.loaders.fieldset import Fieldset
from core.models import Config
from core.postprocessors.decision_tree import DecisionTree, WeatherType
from core.postprocessors.ks_test import format_ks_stats, ks_test_engine, plot_ks_stats
from core.processor import run
from core.svc import postprocessing as postprocessing_svc
from core.utils import inf, sanitize_path, wrap_title

app = Flask(__name__)
CORS(app)

# wrap the flask app and give a heathcheck url
health = HealthCheck(app, "/healthcheck")
envdump = EnvironmentDump(app, "/environment")


@app.errorhandler(Exception)
def handle_error(e):
    code = getattr(e, "code", 500)

    tb = traceback.format_exception_only(type(e), e) or [str(e)]
    return "\n".join(tb), code


is_computation_running = False


@app.route("/computations/start", methods=("POST",))
def start_computation():
    payload = request.get_json()
    config = Config.from_dict(payload)

    global is_computation_running
    is_computation_running = True
    run(config)
    is_computation_running = False

    return Response()


@app.route("/computations/status", methods=("GET",))
def get_computation_status():
    global is_computation_running
    return jsonify({"isRunning": is_computation_running})


@app.route("/predictors", methods=("POST",))
def get_predictors():
    payload = request.get_json()
    path = sanitize_path(payload["path"])

    codes = [
        name
        for name in os.listdir(path)
        if os.path.isdir(os.path.join(path, name)) and not name.startswith(".")
    ]

    # Warming up the LRU cache for fetching units
    for code in codes:
        get_metadata(os.path.join(path, code))

    return Response(json.dumps(codes), mimetype="application/json")


@app.route("/loaders/observations/metadata", methods=("POST",))
def get_obs_metadata():
    payload = request.get_json()
    path = Path(sanitize_path(payload["path"]))

    first_geo_file = next(path.glob("**/*.geo"))

    try:
        units = geopoints_loader.read_units(first_geo_file)
    except ValueError:
        units = None

    return Response(json.dumps({"units": units}), mimetype="application/json")


@app.route("/postprocessing/pdt-tools/statistics", methods=("POST",))
def get_pdt_statistics():
    payload = request.get_json()
    path = sanitize_path(payload["path"])

    resp = postprocessing_svc.get_pdt_statistics(path)
    return Response(json.dumps(resp), mimetype="application/json")


@app.route("/get-pdt-metadata", methods=("POST",))
def get_pdt_metadata():
    payload = request.get_json()
    path = sanitize_path(payload["path"])

    loader = load_point_data_by_path(path)

    return Response(json.dumps(loader.metadata), mimetype="application/json")


@app.route("/postprocessing/create-wt-matrix", methods=("POST",))
def create_weather_types_matrix():
    payload = request.get_json()
    labels, records, ranges = (
        payload["labels"],
        payload["records"],
        payload["fieldRanges"],
    )

    df = pandas.DataFrame.from_records(records, columns=labels)
    thrL, thrH = df.iloc[:, ::2], df.iloc[:, 1::2]
    dt = DecisionTree.create_from_sparse_thresholds(low=thrL, high=thrH, ranges=ranges)

    df_out = pandas.concat([dt.threshold_low, dt.threshold_high], axis=1)
    df_out = df_out[labels]

    matrix = [[str(cell) for cell in row] for row in df_out.values]

    return jsonify({"matrix": matrix})


@app.route("/postprocessing/get-wt-codes", methods=("POST",))
def get_wt_codes():
    payload = request.get_json()

    labels, records, ranges = (
        payload["labels"],
        payload["matrix"],
        payload["fieldRanges"],
    )

    records = [[float(cell) for cell in row] for row in records]

    df = pandas.DataFrame.from_records(records, columns=labels)

    thrL, thrH = df.iloc[:, ::2], df.iloc[:, 1::2]

    dt = DecisionTree(threshold_low=thrL, threshold_high=thrH, ranges=ranges)
    return jsonify({"codes": dt.leaf_codes})


@app.route("/postprocessing/create-decision-tree", methods=("POST",))
def get_decision_tree():
    payload = request.get_json()
    labels, matrix, ranges = (
        payload["labels"],
        payload["matrix"],
        payload["fieldRanges"],
    )

    matrix = [[float(cell) for cell in row] for row in matrix]

    df = pandas.DataFrame.from_records(matrix, columns=labels)

    thrL, thrH = df.iloc[:, ::2], df.iloc[:, 1::2]

    dt = DecisionTree(threshold_low=thrL, threshold_high=thrH, ranges=ranges)

    # Use lazy tree for large trees (>1000 WTs)
    num_wt = len(thrL)
    if num_wt > 1000:
        max_depth = payload.get("maxDepth", 3)
        return jsonify([dt.tree_lazy(max_depth=max_depth).json])
    else:
        return jsonify([dt.tree.json])


@app.route("/postprocessing/expand-tree-node", methods=("POST",))
def expand_tree_node():
    payload = request.get_json()
    labels, matrix, ranges = (
        payload["labels"],
        payload["matrix"],
        payload["fieldRanges"],
    )
    wt_from = payload["wtFrom"]
    wt_to = payload["wtTo"]
    max_depth = payload.get("maxDepth", 3)
    node_level = payload.get("nodeLevel")
    node_code = payload.get("nodeCode")

    matrix = [[float(cell) for cell in row] for row in matrix]

    df = pandas.DataFrame.from_records(matrix, columns=labels)

    thrL, thrH = df.iloc[:, ::2], df.iloc[:, 1::2]

    dt = DecisionTree(threshold_low=thrL, threshold_high=thrH, ranges=ranges)
    children = dt.expand_node(
        wt_from, wt_to, max_depth=max_depth,
        node_level=node_level, node_code=node_code,
    )

    return jsonify({"children": children})


@app.route("/postprocessing/generate-wt-histogram", methods=("POST",))
def get_wt_histogram():
    payload = request.get_json()
    labels, thrWT, path, y_lim, bins, num_bins, cheaper = (
        payload["labels"],
        payload["thrWT"],
        sanitize_path(payload["path"]),
        payload["yLim"],
        payload["bins"],
        payload["numBins"],
        payload["cheaper"],
    )

    loader = load_point_data_by_path(path, cheaper=cheaper)

    thrWT = [float(cell) for cell in thrWT]
    series = pandas.Series(dict(zip(labels, thrWT)))
    thrL, thrH = series.iloc[::2], series.iloc[1::2]

    bins = [float(each) for each in bins]

    wt = WeatherType(
        thrL=thrL, thrH=thrH, thrL_labels=labels[::2], thrH_labels=labels[1::2]
    )

    df, title_tokens = wt.evaluate(loader.error_type.name, loader=loader)
    title = wrap_title(title=title_tokens, chunk_size=6)

    error = df[loader.error_type.name]
    plot = wt.plot(error, bins, title, y_lim=int(y_lim), num_bins=int(num_bins))

    return jsonify({"histogram": plot})


@app.route("/postprocessing/save-wt-histograms", methods=("POST",))
def save_wt_histograms():
    payload = request.get_json()
    labels, thrGridOut, path, y_lim, destination, bins, num_bins, cheaper = (
        payload["labels"],
        payload["thrGridOut"],
        sanitize_path(payload["path"]),
        payload["yLim"],
        payload["destinationDir"],
        payload["bins"],
        payload["numBins"],
        payload["cheaper"],
    )
    destination = sanitize_path(destination)

    loader = load_point_data_by_path(path, cheaper=cheaper)

    matrix = [[float(cell) for cell in row[1:]] for row in thrGridOut]
    df = pandas.DataFrame.from_records(matrix, columns=labels)

    bins = [float(each) for each in bins]

    thrL_out, thrH_out = df.iloc[:, ::2], df.iloc[:, 1::2]

    # Vectorized: assign all rows to WTs in a single pass
    dt = DecisionTree(threshold_low=thrL_out, threshold_high=thrH_out, ranges={})
    error_col = loader.error_type.name
    wt_indices, eval_df = dt.evaluate_all(loader, error_col)
    error_values = eval_df[error_col].to_numpy()

    for idx in range(len(thrL_out)):
        mask = wt_indices == idx
        wt_error = pandas.Series(error_values[mask])

        title = wrap_title(title=dt.wt_title_tokens(idx), chunk_size=6)

        wt = WeatherType(
            thrL=thrL_out.iloc[idx], thrH=thrH_out.iloc[idx],
            thrL_labels=labels[::2], thrH_labels=labels[1::2],
            error_type=loader.error_type,
        )

        wt_code = thrGridOut[idx][0]
        wt.plot(
            wt_error,
            bins,
            title,
            y_lim=int(y_lim),
            num_bins=int(num_bins),
            out_path=os.path.join(destination, f"WT_{wt_code}.png"),
        )

    return jsonify({"status": "success"})


@app.route("/postprocessing/create-error-rep", methods=("POST",))
def get_error_rep():
    payload = request.get_json()
    labels, matrix, path, numCols, cheaper, ranges = (
        payload["labels"],
        payload["matrix"],
        sanitize_path(payload["path"]),
        payload["numCols"],
        payload["cheaper"],
        payload["ranges"],
    )

    matrix = [[float(cell) for cell in row] for row in matrix]
    df = pandas.DataFrame.from_records(matrix, columns=labels)
    thrL, thrH = df.iloc[:, ::2], df.iloc[:, 1::2]
    loader = load_point_data_by_path(path, cheaper=cheaper)

    dt = DecisionTree(threshold_low=thrL, threshold_high=thrH, ranges=ranges)
    rep = dt.cal_rep_error(loader, nBin=int(numCols))

    s = StringIO()
    rep.to_csv(s)
    return jsonify(s.getvalue())


@app.route("/postprocessing/save", methods=("POST",))
def save_operation():
    payload = request.get_json()

    labels = payload["labels"]
    matrix = payload["matrix"]
    ranges = payload["fieldRanges"]
    pdt_path = sanitize_path(payload["pdtPath"])
    mf_cols = payload["mfcols"]
    cheaper = payload["cheaper"]
    mode = payload["mode"]
    output_path = Path(sanitize_path(payload["outPath"]))

    if mode == "all":
        version = payload["version"]
        family = payload["family"]
        accumulation = payload["accumulation"]
        accumulation = f"{accumulation}h" if accumulation else ""
        dataset_name = payload["datasetName"]

        output_path = output_path / f"{family}{accumulation}{dataset_name}_{version}"

        os.makedirs(output_path, exist_ok=True)

    if mode in ["breakpoints", "all"]:
        csv = payload["breakpointsCSV"]
        path = output_path
        if mode == "all":
            path = path / "BP.csv"

        with open(path, "w") as f:
            f.write(csv)

    if mode in ["mf", "all"]:
        matrix = [[float(cell) for cell in row] for row in matrix]
        df = pandas.DataFrame.from_records(matrix, columns=labels)
        thrL, thrH = df.iloc[:, ::2], df.iloc[:, 1::2]
        loader = load_point_data_by_path(pdt_path, cheaper=cheaper)

        dt = DecisionTree(threshold_low=thrL, threshold_high=thrH, ranges=ranges)
        rep = dt.cal_rep_error(loader, nBin=int(mf_cols))

        path = output_path
        if mode == "all":
            path = path / f"{loader.error_type.name}.csv"

        with open(path, "w") as f:
            rep.to_csv(
                f,
                header=[str(i + 1) for i in range(int(mf_cols))],
                index_label="WT Code",
            )

    if mode in ["wt", "all"]:
        ylim = payload["yLim"]
        bins = payload["bins"]
        num_bins = payload["numBins"]
        thrGridOut = payload["thrGridOut"]

        matrix = [[float(cell) for cell in row[1:]] for row in thrGridOut]
        df = pandas.DataFrame.from_records(matrix, columns=labels)

        loader = load_point_data_by_path(pdt_path, cheaper=cheaper)
        bins = [float(each) for each in bins]

        thrL_out, thrH_out = df.iloc[:, ::2], df.iloc[:, 1::2]

        path = output_path
        if mode == "all":
            path = path / "WTs"
            os.makedirs(path, exist_ok=True)

        # Vectorized: single-pass WT assignment
        dt = DecisionTree(threshold_low=thrL_out, threshold_high=thrH_out, ranges=ranges)
        error_col = loader.error_type.name
        wt_indices, eval_df = dt.evaluate_all(loader, error_col)
        error_values = eval_df[error_col].to_numpy()

        for idx in range(len(thrL_out)):
            mask = wt_indices == idx
            wt_error = pandas.Series(error_values[mask])

            title = wrap_title(title=dt.wt_title_tokens(idx), chunk_size=6)

            wt = WeatherType(
                thrL=thrL_out.iloc[idx], thrH=thrH_out.iloc[idx],
                thrL_labels=labels[::2], thrH_labels=labels[1::2],
                error_type=loader.error_type,
            )

            wt_code = thrGridOut[idx][0]
            wt.plot(
                wt_error,
                bins,
                title,
                y_lim=int(ylim),
                num_bins=int(num_bins),
                out_path=os.path.join(path, f"WT_{wt_code}.png"),
            )

    if mode in ["bias", "all"]:
        thrGridOut = payload["thrGridOut"]
        bins = payload["bins"]
        num_bins = payload["numBins"]
        bins = [float(each) for each in bins]

        matrix = [[float(cell) for cell in row[1:]] for row in thrGridOut]
        df = pandas.DataFrame.from_records(matrix, columns=labels)

        loader = load_point_data_by_path(pdt_path, cheaper=cheaper)

        thrL_out, thrH_out = df.iloc[:, ::2], df.iloc[:, 1::2]

        path = output_path
        if mode == "all":
            path = path / "Bias.csv"

        # Vectorized: single-pass WT assignment
        dt = DecisionTree(threshold_low=thrL_out, threshold_high=thrH_out, ranges=ranges)
        error_col = loader.error_type.name
        wt_indices, eval_df = dt.evaluate_all(loader, error_col)
        error_values = eval_df[error_col].to_numpy()

        csv = []
        for idx in range(len(thrL_out)):
            mask = wt_indices == idx
            wt_error = pandas.Series(error_values[mask])
            discretized_error = WeatherType.discretize_error(wt_error, num_bins=int(num_bins))

            bias = loader.error_type.bias(
                error=discretized_error, low=bins[0], high=bins[-1]
            )
            bias = f"{bias:.2f}"

            wt_code = thrGridOut[idx][0]
            csv += [(wt_code, bias)]

        pandas.DataFrame.from_records(csv, columns=["WT Code", "Bias"]).to_csv(
            path, index=False
        )

    if mode == "all":
        family = payload["family"]
        version = payload["version"]

        accumulation = payload["accumulation"]
        accumulation = f", {accumulation}-hourly" if accumulation else ""

        with open(output_path / "README.txt", "w") as f:
            text = dedent(
                f"""
                ecPoint-{family}{accumulation}
                Version: {version}
                Timestamp: {datetime.now()}
                """
            )

            f.write(text.lstrip())

        loader = load_point_data_by_path(pdt_path, cheaper=cheaper)

        if pdt_path.endswith(".ascii"):
            ext = "ascii"
        elif pdt_path.endswith(".parquet"):
            ext = "parquet"
        else:
            ext = "ascii"

        exclude_cols = payload["excludePredictors"]
        cols = [col for col in loader.columns if col not in exclude_cols]

        loader.clone(*cols, path=output_path / f"PDT.{ext}")

    return Response(json.dumps({}), mimetype="application/json")


@app.route("/get-predictor-metadata", methods=("POST",))
def get_predictor_units():
    payload = request.get_json()
    path = sanitize_path(payload["path"])

    metadata = get_metadata(path)
    return Response(json.dumps(metadata), mimetype="application/json")


@app.route("/postprocessing/breakpoints/suggest", methods=("POST",))
def get_breakpoints_suggestions():
    payload = request.get_json()

    labels, thrWT, path, predictor, num_bp, lower_bound, upper_bound, cheaper = (
        payload["labels"],
        payload["thrWT"],
        sanitize_path(payload["path"]),
        payload["predictor"],
        int(payload["numBreakpoints"]),
        payload.get("lowerBound"),
        payload.get("upperBound"),
        payload["cheaper"],
    )

    loader = load_point_data_by_path(path, cheaper=cheaper)

    thrWT = [float(cell) for cell in thrWT]
    series = pandas.Series(dict(zip(labels, thrWT)))
    thrL, thrH = series.iloc[::2], series.iloc[1::2]

    lower_bound = float(lower_bound) if lower_bound else -inf
    upper_bound = float(upper_bound) if upper_bound else inf

    wt = WeatherType(
        thrL=thrL, thrH=thrH, thrL_labels=labels[::2], thrH_labels=labels[1::2]
    )

    df, title_tokens = wt.evaluate(loader.error_type.name, predictor, loader=loader)
    title_tokens = [
        f"({lower_bound} <= {predictor} < {upper_bound})"
        if predictor in token
        else token
        for token in title_tokens
    ]
    title_ks = wrap_title(title_tokens, chunk_size=4)

    df_breakpoints, df_size = ks_test_engine(
        df=df,
        predictor_name=predictor,
        error_name=loader.error_type.name,
        breakpoints_num=num_bp,
        lower_bound=lower_bound,
        upper_bound=upper_bound,
    )

    plot = plot_ks_stats(
        df=df_breakpoints,
        node=title_ks + f"\n\nNo. of points: {df_size}",
        predictor=predictor,
        unit=loader.units["predictors"][predictor],
    )
    df_breakpoints = format_ks_stats(df_breakpoints)

    return Response(
        json.dumps(
            {
                "records": df_breakpoints.to_dict("records"),
                "figure": plot,
                "count": df_size,
            }
        ),
        mimetype="application/json",
    )


@app.route("/postprocessing/plot-cv-map", methods=("POST",))
def get_obs_frequency():
    payload = request.get_json()
    labels, thrWT, path, code, mode, cheaper = (
        payload["labels"],
        payload["thrWT"],
        sanitize_path(payload["path"]),
        payload["code"],
        payload["mode"],
        payload["cheaper"],
    )

    loader = load_point_data_by_path(path, cheaper=cheaper)

    thrWT = [float(cell) for cell in thrWT]
    series = pandas.Series(dict(zip(labels, thrWT)))
    thrL, thrH = series.iloc[::2], series.iloc[1::2]

    wt = WeatherType(
        thrL=thrL, thrH=thrH, thrL_labels=labels[::2], thrH_labels=labels[1::2]
    )

    df, _ = wt.evaluate(
        loader.error_type.name, "LonOBS", "LatOBS", "OBS", loader=loader
    )
    cv_map = wt.plot_maps(df, code, mode.lower())

    return jsonify(cv_map)


################################################################################
# AI-assisted plot modification endpoints
################################################################################

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

_SYSTEM_PROMPT = """\
You are an expert Python developer specialising in geospatial data visualisation
with earthkit.maps (built on top of matplotlib and cartopy).

The user will give you the CURRENT Python plotting code together with a
natural-language instruction describing how to change the plot.
Return ONLY the modified Python code — no explanation, no markdown fences,
no comments about what you changed.

The code must:
- be a complete, self-contained function called `custom_plot(lons, lats, values, code)`
  that returns a dict `{"image": <base64_png_string>}`.
- import everything it needs at the top of the function body.
- encode the result as a base64 PNG string (not PDF).
- never call plt.show().
- Keep the signature exactly: `def custom_plot(lons, lats, values, code):`

IMPORTANT — earthkit.maps API reference:
- `chart = ekm.Chart()` — create chart. Constructor accepts: domain, domain_crs, crs
- `chart.scatter(values, x=lons, y=lats, style=style, s=2)` — scatter plot. Data is first arg, coords via x= y=.
- `chart.coastlines(linewidth=0.8, color="sienna")` — add coastlines
- `chart.borders(linewidth=0.4, color="sienna")` — add country borders
- `chart.land()`, `chart.ocean()`, `chart.lakes()`, `chart.rivers()` — natural features
- `chart.gridlines()` — add lat/lon grid
- `chart.title("text")` — set title
- `chart.save(path_or_buf, format="png", dpi=150)` — save to file or BytesIO
- `chart.fig` — access the underlying matplotlib Figure
- `chart.fig.get_axes()[0]` — access the underlying cartopy GeoAxes
- `ekm.Style(colors=[...], levels=[...], legend_style="colorbar")` — define binned style
- `ekm.Chart(domain="Europe")` — zoom to a named domain. Available: "global", "Europe",
  "North America", "South America", "Africa", "Asia", "Oceania", "Arctic", "Antarctic"
- `ekm.Chart(crs=ccrs.Mollweide())` — use Mollweide projection (default in this app).
  Other projections: ccrs.PlateCarree(), ccrs.Robinson(), ccrs.Orthographic(), etc.
  Always `import cartopy.crs as ccrs` when changing projections.

To zoom to a custom area, access the underlying cartopy axes:
  `ax = chart.fig.get_axes()[0]`
  `ax.set_extent([lon_min, lon_max, lat_min, lat_max])`

Do NOT use `chart.set_extent()` — that method does not exist.
Do NOT use `chart.domain(...)` as a method call — domain is a constructor parameter only.
"""


@app.route("/postprocessing/ai-modify-plot", methods=("POST",))
def ai_modify_plot():
    """Call Gemini to modify the current Earth-Kit / matplotlib code."""
    try:
        import requests as http_requests

        payload = request.get_json()
        current_code = payload["code"]
        user_instruction = payload["instruction"]

        prompt = (
            f"CURRENT CODE:\n```python\n{current_code}\n```\n\n"
            f"USER INSTRUCTION: {user_instruction}\n\n"
            "Return the modified code following the system rules."
        )

        gemini_url = (
            f"https://generativelanguage.googleapis.com/v1beta/"
            f"models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        )

        gemini_payload = {
            "contents": [{
                "parts": [{"text": _SYSTEM_PROMPT + "\n\n" + prompt}]
            }]
        }

        resp = http_requests.post(gemini_url, json=gemini_payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()

        modified_code = data["candidates"][0]["content"]["parts"][0]["text"].strip()

        # Strip markdown fences if Gemini adds them despite instructions
        if modified_code.startswith("```"):
            lines = modified_code.split("\n")
            lines = [l for l in lines if not l.startswith("```")]
            modified_code = "\n".join(lines)

        return jsonify({"code": modified_code})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/postprocessing/run-custom-plot", methods=("POST",))
def run_custom_plot():
    """Execute user-supplied plotting code and return the base64 PNG."""
    try:
        import base64
        import numpy as np

        payload = request.get_json()
        code_text = payload["code"]
        labels = payload["labels"]
        thrWT = payload["thrWT"]
        path = sanitize_path(payload["path"])
        wt_code = payload["wtCode"]
        mode = payload["mode"]
        cheaper = payload["cheaper"]

        # Load and prepare the data (same as plot-cv-map)
        loader = load_point_data_by_path(path, cheaper=cheaper)
        thrWT_floats = [float(cell) for cell in thrWT]
        series = pandas.Series(dict(zip(labels, thrWT_floats)))
        thrL, thrH = series.iloc[::2], series.iloc[1::2]

        wt = WeatherType(
            thrL=thrL, thrH=thrH, thrL_labels=labels[::2], thrH_labels=labels[1::2]
        )
        df, _ = wt.evaluate(
            loader.error_type.name, "LonOBS", "LatOBS", "OBS", loader=loader
        )

        # Prepare the data arrays based on mode
        if mode.lower() == "a":
            grouped = df[["LonOBS", "LatOBS", "OBS"]].groupby(
                ["LatOBS", "LonOBS"], as_index=False
            ).count()
            lons = grouped["LonOBS"].to_numpy(dtype=np.float64)
            lats = grouped["LatOBS"].to_numpy(dtype=np.float64)
            values = grouped["OBS"].to_numpy(dtype=np.float64)
        else:
            error = "FER" if "FER" in df.columns else "FE"
            grouped = df[["LonOBS", "LatOBS", error]].groupby(["LatOBS", "LonOBS"])
            if mode.lower() == "b":
                grouped = grouped[error].mean().reset_index()
            else:
                grouped = grouped[error].std().reset_index()
            lons = grouped["LonOBS"].to_numpy(dtype=np.float64)
            lats = grouped["LatOBS"].to_numpy(dtype=np.float64)
            values = grouped[error].to_numpy(dtype=np.float64)

        # Execute the user code in a restricted namespace
        exec_globals = {}
        exec(code_text, exec_globals)
        result = exec_globals["custom_plot"](lons, lats, values, wt_code)

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@lru_cache(maxsize=None)
def get_metadata(path):
    base_predictor_path = Path(path)

    if not base_predictor_path.exists():
        return "-"

    first_grib_file = next(base_predictor_path.glob("**/*.grib"))

    fieldset = Fieldset.from_path(first_grib_file)
    return {"units": fieldset.units, "name": fieldset.name}


def main():
    kwargs = {
        "host": "0.0.0.0",
        "port": "8888",
        "use_reloader": True if "DEBUG" in os.environ else False,
    }

    app.run(**kwargs)


if __name__ == "__main__":
    main()
