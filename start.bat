@echo off
REM ecPoint-Calibrate Web App Startup Script
REM Starts both the Flask backend and Express frontend server

echo === ecPoint-Calibrate Web App ===
echo.

echo Starting Flask backend on port 8888...
start /B python -m core.api

REM Wait a moment for Flask to start
timeout /t 2 /nobreak >nul

echo Starting Express frontend on port 3000...
start /B node web-server.js

echo.
echo ecPoint-Calibrate is running at http://localhost:3000
echo Flask backend is running at http://localhost:8888
echo.
echo Press Ctrl+C to stop both servers.

REM Keep the window open
pause
