#!/bin/bash
# ecPoint-Calibrate Web App Startup Script
# Starts both the Flask backend and Express frontend server

set -e

PYTHON="${PYTHON:-python}"
NODE="${NODE:-node}"

echo "=== ecPoint-Calibrate Web App ==="
echo ""

# Start Flask backend
echo "Starting Flask backend on port 8888..."
"$PYTHON" -m core.api &
BACKEND_PID=$!

# Wait a moment for Flask to start
sleep 2

# Start Express web server
echo "Starting Express frontend on port 3000..."
"$NODE" web-server.js &
FRONTEND_PID=$!

echo ""
echo "ecPoint-Calibrate is running at http://localhost:3000"
echo "Flask backend is running at http://localhost:8888"
echo ""
echo "Press Ctrl+C to stop both servers."

# Trap Ctrl+C and kill both processes
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID 2>/dev/null
  echo "Done."
}

trap cleanup EXIT INT TERM

# Wait for either process to exit
wait
