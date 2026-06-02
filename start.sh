#!/usr/bin/env bash
# ecPoint-Calibrate - start the app (macOS / Linux)
# Starts the Flask backend and the Express frontend, then opens the browser.

set -e

if [ ! -x ".venv/bin/python" ]; then
  echo "[ERROR] No Python environment found. Run 'bash setup.sh' first."
  exit 1
fi

echo "=== ecPoint-Calibrate ==="
echo

echo "Starting Flask backend on port 8888..."
.venv/bin/python -m core.api &
BACKEND_PID=$!

echo "Starting Express frontend on port 3000..."
node web-server.js &
FRONTEND_PID=$!

# Open the browser once the servers have had a moment to start
( sleep 6
  if command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:3000
  elif command -v open >/dev/null 2>&1; then open http://localhost:3000
  fi ) >/dev/null 2>&1 &

echo
echo "ecPoint-Calibrate is starting at http://localhost:3000"
echo "Press Ctrl+C to stop."

cleanup() {
  echo
  echo "Shutting down..."
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM
wait
