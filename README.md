# ecPoint-Calibrate

![coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/FatimaPillosu/ecpoint-calibrate/main/.github/badges/coverage.json) ![license](https://img.shields.io/github/license/FatimaPillosu/ecpoint-calibrate?color=orange) ![release](https://img.shields.io/github/v/release/FatimaPillosu/ecpoint-calibrate?color=8e44ad)

ecPoint-Calibrate uses conditional verification to compare numerical weather prediction (NWP) model outputs against point observations, in order to anticipate sub-grid variability and identify biases at grid scale. It provides a user-friendly environment to post-process NWP outputs (e.g. precipitation and temperature) and produce calibrated, probabilistic point-scale forecasts for any location worldwide.

Development was originally sponsored by the [ECMWF Summer of Weather Code (ESoWC)](https://esowc.ecmwf.int/) programme at [ECMWF](https://www.ecmwf.int).

## Architecture

ecPoint-Calibrate runs as two local processes:

- **Backend** — a Flask REST API (`core/`, Python) on port **8888**. GRIB and geopoints I/O is handled by `earthkit-data` / `earthkit-geo` (which bundle the eccodes engine via pip wheels), and maps are drawn with `earthkit-maps`. A plain virtualenv is all that's required.
- **Frontend** — a React/Redux UI (`ui/`) bundled by webpack and served by a small Express proxy (`web-server.js`) on port **3000**, which forwards API calls to the backend. You open it in your browser at <http://localhost:3000>.

## Prerequisites

- Python **3.11 or newer**
- Node.js (LTS) and npm

> **macOS:** the `python3` that ships with macOS is **3.9**, which is too old. Install a newer
> one (`brew install python@3.11`, or from [python.org](https://www.python.org/downloads/)) — it
> becomes available as the **`python3.11`** command and does *not* replace `python3`. `setup.sh`
> finds it automatically; if you install by hand, use `python3.11` explicitly. See
> [Troubleshooting](#troubleshooting) if you hit a Python-version error.

## Installing ecPoint-Calibrate

To install ecPoint-Calibrate, download the repository (**Code → Download ZIP**, or `git clone`).
Then, run the two following steps:

### 1. Setup (once)
Users must pre-install **Python 3.11** and **Node.js**.
Then, execute:
```bash
setup.bat       # Windows
./setup.sh      # macOS / Linux
```
They check for Python 3.11 and Node.js (and provide guidance on how to install them if not found), 
create `.venv`, install all dependencies, and build the UI.

The manual steps, if preferred:

**Python backend**
```bash
python -m venv .venv
# activate:  Windows -> .venv\Scripts\activate   |   macOS/Linux -> source .venv/bin/activate
pip install -e .          # installs the dependencies declared in pyproject.toml
```

**Frontend**
```bash
npm install
npm run build             # bundles the UI into dist/
```

> The webpack 4 build needs Node's legacy OpenSSL provider (Node 17+). This is configured
> automatically in `.npmrc` (`node-options=--openssl-legacy-provider`), so `npm run build`
> works as-is — no environment variable needed.


### 2. Run (every time to open ecPoint-Calibrate)
Execute:
```bash
start.bat       # Windows
./start.sh      # macOS / Linux
```
They start the backend and frontend, and open the app at <http://localhost:3000>.

## Troubleshooting

**macOS — `ERROR: Package 'ecpoint-calibrate' requires a different Python: 3.9.x not in '>=3.11,<4.0'`**

macOS's built-in `python3` is **3.9**, and installing 3.11 adds a *separate* `python3.11`
command without replacing `python3`. If `.venv` was built with 3.9 (by the manual steps, or an
older `setup.sh`), rebuild it with 3.11 explicitly:

```bash
python3.11 --version          # confirm: Python 3.11.x
rm -rf .venv
python3.11 -m venv .venv
./.venv/bin/python -m pip install -e .
bash start.sh
```

If `python3.11` reports *"command not found"*, it isn't on your PATH yet — install it via
`brew install python@3.11` or from [python.org](https://www.python.org/downloads/).

**`npm error code ETARGET` — `No matching version found for prop-types@>=16`**

A UI dependency (`react-datasheet`) declares an outdated peer dependency that strict modern
npm (v7+) rejects. The repo's `.npmrc` already sets `legacy-peer-deps=true`, so a fresh
`npm install` works — but on an older checkout, or if you see this error, install with:

```bash
npm install --legacy-peer-deps
```

The `npm warn ERESOLVE` lines printed during a normal install are harmless.

## Tests

```bash
pytest          # Python backend
npm test        # frontend (Jest)
```

## Project layout

```
core/            Flask backend — API, loaders, processor, post-processors
ui/              React/Redux frontend
web-server.js    Express server + proxy to the Flask backend
setup.bat/.sh    One-time environment setup (venv + deps + UI build)
start.bat/.sh    Start the backend + frontend and open the app
pyproject.toml   Python dependencies (single source of truth)
package.json     Node dependencies and run scripts
```
