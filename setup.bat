@echo off
REM ecPoint-Calibrate - one-time setup (Windows)
REM Creates the Python environment, installs all dependencies, and builds the UI.

echo === ecPoint-Calibrate setup ===
echo.

REM 1. Check prerequisites
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found.
  echo         Install Python 3.11+ from https://www.python.org/downloads/
  echo         and tick "Add python.exe to PATH" during install, then re-run setup.bat.
  echo.
  pause
  exit /b 1
)
python -c "import sys; sys.exit(0 if sys.version_info[:2] >= (3, 11) else 1)" 2>nul
if errorlevel 1 (
  echo [ERROR] Python 3.11+ is required, but the 'python' on your PATH is older.
  echo         Install Python 3.11+ from https://www.python.org/downloads/ then re-run.
  echo.
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo         Install the LTS version from https://nodejs.org/ then re-run setup.bat.
  echo.
  pause
  exit /b 1
)

REM 2. Python backend: fresh environment + dependencies
echo Creating the Python environment (.venv) and installing dependencies...
echo This can take a few minutes the first time.
if exist .venv rmdir /s /q .venv
python -m venv .venv
if errorlevel 1 ( echo [ERROR] Could not create the virtual environment. & pause & exit /b 1 )
call .venv\Scripts\python.exe -m pip install -e .
if errorlevel 1 ( echo [ERROR] Python dependency installation failed. & pause & exit /b 1 )

REM 3. Frontend: install Node packages and build the UI
echo Installing UI dependencies...
call npm install
if errorlevel 1 ( echo [ERROR] npm install failed. & pause & exit /b 1 )
echo Building the user interface...
call npm run build
if errorlevel 1 ( echo [ERROR] UI build failed. & pause & exit /b 1 )

echo.
echo === Setup complete! ===
echo To start ecPoint-Calibrate, double-click start.bat
echo.
pause
