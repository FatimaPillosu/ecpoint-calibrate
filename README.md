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

## Packaging desktop executables

`electron-builder` produces a one-click executable per platform:

```bash
npm run dist:win      # Windows portable .exe
npm run dist:linux    # Linux AppImage
npm run dist:mac      # macOS .dmg
```

The GitHub Actions workflow `.github/workflows/build-electron.yml` builds all three on a
`v*` tag push (or manual dispatch) and uploads the artifacts.

> Note: these package the Electron/UI layer. Bundling the Python backend into the
> executable so it runs fully standalone is still in progress.

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
electron.js      Electron desktop entry point
pyproject.toml   Python dependencies (single source of truth)
package.json     Node dependencies and build/run scripts
```
