# ecPoint-Calibrate

![coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/FatimaPillosu/ecpoint-calibrate/main/.github/badges/coverage.json) ![license](https://img.shields.io/github/license/FatimaPillosu/ecpoint-calibrate)

ecPoint-Calibrate uses conditional verification to compare numerical weather prediction (NWP) model outputs against point observations, in order to anticipate sub-grid variability and identify biases at grid scale. It provides a user-friendly environment to post-process NWP parameters (precipitation, wind, temperature, etc.) and produce calibrated, probabilistic products for any location worldwide, up to the medium range.

Development was originally sponsored by the [ECMWF Summer of Weather Code (ESoWC)](https://esowc.ecmwf.int/) programme at [ECMWF](https://www.ecmwf.int).

## Architecture

ecPoint-Calibrate runs as two local processes, optionally wrapped in an Electron desktop window:

- **Backend** — a Flask REST API (`core/`, Python) on port **8888**. GRIB and geopoints I/O is handled by `earthkit-data` / `earthkit-geo` (which bundle the eccodes engine via pip wheels), and maps are drawn with `earthkit-maps`. A plain virtualenv is all that's required.
- **Frontend** — a React/Redux UI (`ui/`) bundled by webpack and served by a small Express proxy (`web-server.js`) on port **3000**, which forwards API calls to the backend.
- **Desktop** — `electron.js` opens the frontend in a native window; this is the entry point for the packaged executables.

## Prerequisites

- Python **3.11**
- Node.js (LTS) and npm

## Setup

The fastest path is the one-time setup script — **`setup.bat`** (Windows) or
**`bash setup.sh`** (macOS/Linux) — which runs everything below automatically. The
manual steps, if you prefer:

### 1. Python backend

```bash
python -m venv .venv
# activate:  Windows -> .venv\Scripts\activate   |   macOS/Linux -> source .venv/bin/activate
pip install -e .          # installs the dependencies declared in pyproject.toml
```

### 2. Frontend

```bash
npm install
npm run build             # bundles the UI into dist/
```

> The webpack 4 build needs Node's legacy OpenSSL provider (Node 17+). This is configured
> automatically in `.npmrc` (`node-options=--openssl-legacy-provider`), so `npm run build`
> works as-is — no environment variable needed.

## Running

Start both servers and open <http://localhost:3000>:

```bash
start.bat       # Windows
./start.sh      # macOS / Linux
```

Each script launches the Flask backend (`python -m core.api`, port 8888) and the Express
frontend (`node web-server.js`, port 3000). Make sure the virtualenv from step 1 is active
(or, on Windows, that `.venv` exists — `start.bat` uses it directly).

## Sharing the app (no installer)

There is no packaged installer — ecPoint-Calibrate runs from source. This avoids
code-signing/notarization requirements and works the same on Windows, macOS, and Linux.
To share it, people download the repository (**Code → Download ZIP**, or `git clone`)
and run two scripts:

1. **Setup (once):** `setup.bat` (Windows) or `bash setup.sh` (macOS/Linux) — checks for
   Python 3.11 and Node.js, creates `.venv`, installs all dependencies, and builds the UI.
2. **Run:** `start.bat` (Windows) or `bash start.sh` (macOS/Linux) — starts the backend
   and frontend and opens the app at <http://localhost:3000>.

The only things a user installs themselves are **Python 3.11** and **Node.js**.

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
