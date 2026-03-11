@echo off
title Google Auto Login Tool
cd /d "%~dp0"

echo ========================================
echo   Google Auto Login Tool
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

REM Install dependencies if needed
echo [INFO] Checking dependencies...
python -m pip install -q selenium undetected-chromedriver customtkinter requests Pillow screeninfo

echo.
echo [INFO] Starting Google Auto Login Tool...
echo.

python main.py

pause
