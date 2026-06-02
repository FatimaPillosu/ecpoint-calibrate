#!/usr/bin/env bash
# ecPoint-Calibrate - one-time setup (macOS / Linux)
# Creates the Python environment, installs all dependencies, and builds the UI.

set -e

echo "=== ecPoint-Calibrate setup ==="
echo

# 1. Check prerequisites
command -v python3 >/dev/null 2>&1 || { echo "[ERROR] Python 3.11 not found. Install it from https://www.python.org/downloads/ and re-run."; exit 1; }
command -v npm     >/dev/null 2>&1 || { echo "[ERROR] Node.js not found. Install the LTS from https://nodejs.org/ and re-run."; exit 1; }

# 2. Python backend: isolated environment + dependencies
echo "Creating the Python environment (.venv) and installing dependencies..."
echo "This can take a few minutes the first time."
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -e .

# 3. Frontend: install Node packages and build the UI
echo "Installing UI dependencies..."
npm install
echo "Building the user interface..."
npm run build

echo
echo "=== Setup complete! ==="
echo "To start ecPoint-Calibrate, run: bash start.sh"
