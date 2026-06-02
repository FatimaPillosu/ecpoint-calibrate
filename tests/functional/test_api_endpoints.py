"""End-to-end coverage for the Flask REST endpoints in core/api.py.

Uses the shared `client` fixture (tests/functional/conftest.py) and the real
precomputed PDT / GRIB / geopoints test data, so each test drives an endpoint
exactly as the React frontend would.

A 2-predictor (CPR x TP) decision tree over the 211-row alfa PDT is the common
fixture: CPR split at 0.5, TP split at 5, giving four weather types that
partition every observation.
"""
import matplotlib

matplotlib.use("Agg")

from tests.conf import TEST_DATA_DIR

PDT_PATH = str(TEST_DATA_DIR / "ecmwf" / "alfa.ascii")
FORECASTS_PATH = str(TEST_DATA_DIR / "ecmwf" / "forecasts")
OBS_PATH = str(TEST_DATA_DIR / "ecmwf" / "observations")

LABELS = ["CPR_thrL", "CPR_thrH", "TP_thrL", "TP_thrH"]
RANGES = {"CPR": ["-inf", "inf"], "TP": ["-inf", "inf"]}

# Full Cartesian matrix: CPR {<0.5, >=0.5} x TP {<5, >=5}
MATRIX = [
    ["-inf", "0.5", "-inf", "5"],
    ["-inf", "0.5", "5", "inf"],
    ["0.5", "inf", "-inf", "5"],
    ["0.5", "inf", "5", "inf"],
]

# Histogram bins (the app's default FER bins) and a single full-range WT.
FER_BINS = [-1.1, -0.99, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 25, 50, 1000]
FULL_RANGE_WT = ["-inf", "inf", "-inf", "inf"]


# --- computation status / logs ---------------------------------------------


def test_computation_status(client):
    resp = client.get("/computations/status")
    assert resp.status_code == 200
    assert "isRunning" in resp.get_json()


def test_computation_logs_default_and_bad_lines_param(client):
    resp = client.get("/computations/logs")
    assert resp.status_code == 200
    assert "content" in resp.get_json()

    # A non-integer `lines` query param must fall back to the default, not 500.
    resp = client.get("/computations/logs?lines=not-a-number")
    assert resp.status_code == 200


# --- pure threshold/tree endpoints (no PDT) --------------------------------


def test_create_wt_matrix_expands_sparse_thresholds(client):
    records = [["-inf", "0.5", "-inf", "inf"], ["0.5", "inf", "", ""]]
    resp = client.post(
        "/postprocessing/create-wt-matrix",
        json={"labels": LABELS, "records": records, "fieldRanges": RANGES},
    )
    assert resp.status_code == 200
    matrix = resp.get_json()["matrix"]
    assert len(matrix) == 2  # CPR has 2 bins, TP has 1 -> 2 weather types


def test_get_wt_codes(client):
    resp = client.post(
        "/postprocessing/get-wt-codes",
        json={"labels": LABELS, "matrix": MATRIX, "fieldRanges": RANGES},
    )
    assert resp.status_code == 200
    assert resp.get_json()["codes"] == ["11", "12", "21", "22"]


def test_create_decision_tree(client):
    resp = client.post(
        "/postprocessing/create-decision-tree",
        json={"labels": LABELS, "matrix": MATRIX, "fieldRanges": RANGES},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list) and data[0]["name"] == "Root"


def test_expand_tree_node(client):
    resp = client.post(
        "/postprocessing/expand-tree-node",
        json={
            "labels": LABELS,
            "matrix": MATRIX,
            "fieldRanges": RANGES,
            "wtFrom": 0,
            "wtTo": 1,
            "maxDepth": 3,
            "nodeLevel": 0,
            "nodeCode": "10",
        },
    )
    assert resp.status_code == 200
    children = resp.get_json()["children"]
    assert [c["meta"]["code"] for c in children] == ["11", "12"]


# --- PDT metadata / statistics ---------------------------------------------


def test_get_pdt_metadata(client):
    resp = client.post("/get-pdt-metadata", json={"path": PDT_PATH})
    assert resp.status_code == 200
    assert "header" in resp.get_json()


def test_pdt_statistics(client):
    resp = client.post("/postprocessing/pdt-tools/statistics", json={"path": PDT_PATH})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["count"] == "211"
    assert data["error"] == "FER"
    assert "CPR" in data["fields"]


# --- observation counting ---------------------------------------------------


def test_count_wt_observations_partitions_all_obs(client):
    resp = client.post(
        "/postprocessing/count-wt-observations",
        json={"labels": LABELS, "matrix": MATRIX, "path": PDT_PATH},
    )
    assert resp.status_code == 200
    counts = resp.get_json()["counts"]
    assert len(counts) == 4
    assert sum(counts) == 211  # the four WTs partition every observation


def test_count_obs_per_wt_partitions_all_obs(client):
    resp = client.post(
        "/postprocessing/count-obs-per-wt",
        json={"labels": LABELS, "matrix": MATRIX, "fieldRanges": RANGES, "path": PDT_PATH},
    )
    assert resp.status_code == 200
    counts = resp.get_json()["counts"]
    assert len(counts) == 4
    assert sum(counts) == 211


def test_eliminate_small_wts(client):
    resp = client.post(
        "/postprocessing/eliminate-small-wts",
        json={
            "labels": LABELS,
            "matrix": MATRIX,
            "fieldRanges": RANGES,
            "path": PDT_PATH,
            "threshold": 80,
        },
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["total_obs_pdt"] == 211
    assert 1 <= data["remaining"] <= 4
    assert data["eliminated"] >= 0


# --- error representation / histograms -------------------------------------


def test_create_error_rep_returns_csv(client):
    resp = client.post(
        "/postprocessing/create-error-rep",
        json={
            "labels": LABELS,
            "matrix": MATRIX,
            "path": PDT_PATH,
            "numCols": 3,
            "cheaper": False,
            "ranges": RANGES,
        },
    )
    assert resp.status_code == 200
    csv = resp.get_json()
    assert isinstance(csv, str) and "11" in csv


def test_generate_wt_histogram(client):
    resp = client.post(
        "/postprocessing/generate-wt-histogram",
        json={
            "labels": LABELS,
            "thrWT": FULL_RANGE_WT,
            "path": PDT_PATH,
            "yLim": 100,
            "bins": FER_BINS,
            "numBins": 10,
            "cheaper": False,
        },
    )
    assert resp.status_code == 200
    assert len(resp.get_json()["histogram"]) > 100


def test_breakpoints_suggest(client):
    resp = client.post(
        "/postprocessing/breakpoints/suggest",
        json={
            "labels": LABELS,
            "thrWT": FULL_RANGE_WT,
            "path": PDT_PATH,
            "predictor": "TP",
            "numBreakpoints": 3,
            "cheaper": False,
        },
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["count"] == 211
    assert len(data["figure"]) > 100
    assert isinstance(data["records"], list)


def test_plot_cv_map(client):
    resp = client.post(
        "/postprocessing/plot-cv-map",
        json={
            "labels": LABELS,
            "thrWT": FULL_RANGE_WT,
            "path": PDT_PATH,
            "code": "00000",
            "mode": "a",
            "cheaper": False,
        },
    )
    assert resp.status_code == 200
    assert "image" in resp.get_json()


# --- save operation (every mode) -------------------------------------------


def _save_payload(tmp_path, mode, **overrides):
    payload = {
        "labels": LABELS,
        "matrix": MATRIX,
        "fieldRanges": RANGES,
        "ranges": RANGES,
        "pdtPath": PDT_PATH,
        "mfcols": 3,
        "cheaper": False,
        "mode": mode,
        "outPath": str(tmp_path),
    }
    payload.update(overrides)
    return payload


def test_save_all_mode_writes_bundle(client, tmp_path):
    out = tmp_path / "calibration"
    resp = client.post(
        "/postprocessing/save",
        json=_save_payload(
            out,
            "all",
            version="1.0",
            parameter="tp",
            accumulation="12",
            datasetName="test-dataset",
            paramType="accumulated",
            breakpointsCSV="a,b\n1,2\n",
        ),
    )
    assert resp.status_code == 200
    assert (out / "BP.csv").exists()
    assert (out / "FER.csv").exists()
    assert (out / "README.txt").exists()


def test_save_wt_mode_writes_histograms(client, tmp_path):
    thr_grid_out = [[row_codes] + row for row_codes, row in zip(
        ["11", "12", "21", "22"], MATRIX
    )]
    resp = client.post(
        "/postprocessing/save",
        json=_save_payload(
            tmp_path,
            "wt",
            thrGridOut=thr_grid_out,
            bins=FER_BINS,
            numBins=10,
            yLim=100,
        ),
    )
    assert resp.status_code == 200
    pngs = list((tmp_path / "WTs").glob("*.png"))
    assert len(pngs) == 4


def test_save_bias_mode_writes_csv(client, tmp_path):
    bias_csv = tmp_path / "Bias.csv"
    thr_grid_out = [[code] + row for code, row in zip(
        ["11", "12", "21", "22"], MATRIX
    )]
    resp = client.post(
        "/postprocessing/save",
        json=_save_payload(
            bias_csv,
            "bias",
            thrGridOut=thr_grid_out,
            bins=FER_BINS,
            numBins=10,
        ),
    )
    assert resp.status_code == 200
    assert bias_csv.exists()
    assert "Bias" in bias_csv.read_text()


def test_save_wt_histograms_endpoint(client, tmp_path):
    thr_grid_out = [[code] + row for code, row in zip(
        ["11", "12", "21", "22"], MATRIX
    )]
    resp = client.post(
        "/postprocessing/save-wt-histograms",
        json={
            "labels": LABELS,
            "thrGridOut": thr_grid_out,
            "path": PDT_PATH,
            "yLim": 100,
            "destinationDir": str(tmp_path),
            "bins": FER_BINS,
            "numBins": 10,
            "cheaper": False,
        },
    )
    assert resp.status_code == 200
    assert len(list(tmp_path.glob("WT_*.png"))) == 4


# --- file-system metadata endpoints ----------------------------------------


def test_predictors_lists_forecast_subdirs(client):
    resp = client.post("/predictors", json={"path": FORECASTS_PATH})
    assert resp.status_code == 200
    codes = resp.get_json()
    assert {"cape", "cp", "sr", "tp", "u700", "v700"}.issubset(set(codes))


def test_get_predictor_metadata(client):
    resp = client.post(
        "/get-predictor-metadata",
        json={"path": str(TEST_DATA_DIR / "ecmwf" / "forecasts" / "tp")},
    )
    assert resp.status_code == 200
    assert "units" in resp.get_json()


def test_observations_metadata(client):
    resp = client.post("/loaders/observations/metadata", json={"path": OBS_PATH})
    assert resp.status_code == 200
    assert "units" in resp.get_json()


# --- custom / AI plot endpoints --------------------------------------------


_CUSTOM_PLOT_CODE = """
def custom_plot(lons, lats, values, code):
    import base64
    from io import BytesIO
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots()
    ax.scatter(lons, lats, c=values)
    buf = BytesIO()
    fig.savefig(buf, format="png")
    buf.seek(0)
    return {"image": base64.b64encode(buf.read()).decode("utf-8")}
"""


def test_run_custom_plot_executes_user_code(client):
    resp = client.post(
        "/postprocessing/run-custom-plot",
        json={
            "code": _CUSTOM_PLOT_CODE,
            "labels": LABELS,
            "thrWT": FULL_RANGE_WT,
            "path": PDT_PATH,
            "wtCode": "00000",
            "mode": "a",
            "cheaper": False,
        },
    )
    assert resp.status_code == 200
    assert "image" in resp.get_json()


def test_run_custom_plot_reports_errors(client):
    resp = client.post(
        "/postprocessing/run-custom-plot",
        json={
            "code": "def custom_plot(*a):\n    raise ValueError('boom')",
            "labels": LABELS,
            "thrWT": FULL_RANGE_WT,
            "path": PDT_PATH,
            "wtCode": "00000",
            "mode": "b",
            "cheaper": False,
        },
    )
    assert resp.status_code == 500
    assert "error" in resp.get_json()


def test_ai_modify_plot_reports_errors_without_network(client):
    # Missing "code" key raises before any Gemini call -> handled error path.
    resp = client.post("/postprocessing/ai-modify-plot", json={})
    assert resp.status_code == 500
    assert "error" in resp.get_json()
