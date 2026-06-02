@echo off
REM ecPoint-Calibrate - start the app (Windows)
REM Starts the Flask backend and the Express frontend, then opens the browser.

echo === ecPoint-Calibrate ===
echo.

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] No Python environment found.
  echo         Run setup.bat first to install everything.
  echo.
  pause
  exit /b 1
)

echo Starting Flask backend on port 8888...
start /B .venv\Scripts\python.exe -m core.api

echo Starting Express frontend on port 3000...
start /B node web-server.js

echo.
echo ecPoint-Calibrate is starting at http://localhost:3000
echo.
echo Opening your browser (if it doesn't appear, open http://localhost:3000 yourself)...
timeout /t 6 /nobreak >nul
start "" http://localhost:3000

echo.
echo Leave this window open while you use the app.
echo Press Ctrl+C, or close this window, to stop it.
pause
