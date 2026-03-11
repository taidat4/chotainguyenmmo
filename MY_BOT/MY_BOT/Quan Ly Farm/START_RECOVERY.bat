@echo off
chcp 65001 >nul
title Farm Account Recovery Tool

echo ══════════════════════════════════════════════════
echo    🔧 FARM ACCOUNT RECOVERY TOOL
echo ══════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [1] Chạy BACKGROUND (không hiện browser)
echo [2] Chạy DEBUG (hiện browser để xem)
echo.

set /p choice="Chọn mode (1/2): "

if "%choice%"=="1" (
    echo.
    echo 🚀 Đang chạy background mode...
    python recovery_tool.py
) else if "%choice%"=="2" (
    echo.
    echo 🚀 Đang chạy debug mode...
    python recovery_tool.py --visible
) else (
    echo.
    echo ❌ Lựa chọn không hợp lệ!
)

echo.
echo ══════════════════════════════════════════════════
pause
