#!/usr/bin/env bash
# ecPoint-Calibrate - one-time setup (macOS / Linux)
# Creates the Python environment, installs all dependencies, and builds the UI.

set -e

echo "=== ecPoint-Calibrate setup ==="
echo

# 1. Find a Python >= 3.11.
#    NOTE: macOS's built-in 'python3' is 3.9 (too old). Installing 3.11 adds a
#    separate 'python3.11' command, so we search for a new-enough one explicitly.
PYTHON=""
for c in python3.13 python3.12 python3.11 python3 python; do
  if command -v "$c" >/dev/null 2>&1; then
    if "$c" -c 'import sys; raise SystemExit(0 if sys.version_info[:2] >= (3, 11) else 1)' 2>/dev/null; then
      PYTHON="$c"
      break
    fi
  fi
done
if [ -z "$PYTHON" ]; then
  echo "[ERROR] Python 3.11+ was not found."
  echo "        (macOS's built-in 'python3' is 3.9, which is too old.)"
  echo "        Install Python 3.11+ and re-run this script:"
  echo "          - Homebrew:  brew install python@3.11"
  echo "          - or download from https://www.python.org/downloads/"
  exit 1
fi
echo "Using $PYTHON ($("$PYTHON" --version 2>&1))"

command -v npm >/dev/null 2>&1 || { echo "[ERROR] Node.js not found. Install the LTS from https://nodejs.org/ and re-run."; exit 1; }

# 2. Python backend: fresh environment + dependencies
echo "Creating the Python environment (.venv) and installing dependencies..."
echo "This can take a few minutes the first time."
rm -rf .venv
"$PYTHON" -m venv .venv
./.venv/bin/python -m pip install -e .

# 3. Frontend: install Node packages and build the UI
echo "Installing UI dependencies..."
npm install
echo "Building the user interface..."
npm run build

echo
echo "=== Setup complete! ==="
echo "To start ecPoint-Calibrate, run: bash start.sh"
