@echo off
REM tiktok-live-recorder - Windows one-click launcher
REM ------------------------------------------------------------------
REM Drop this file next to a checkout of tiktok-live-recorder OR run it
REM from anywhere with Node + npm on PATH. It will:
REM   1. Verify Node is installed.
REM   2. Install tiktok-live-recorder if missing (npm i -g).
REM   3. Verify ffmpeg is installed; download a static build if missing.
REM   4. Prompt for the username and start recording.

setlocal enabledelayedexpansion

where node >nul 2>&1
if errorlevel 1 (
    echo [recorder] Node.js is not installed. Get it from https://nodejs.org/
    pause
    exit /b 1
)

where tiktok-live-recorder >nul 2>&1
if errorlevel 1 (
    echo [recorder] Installing tiktok-live-recorder globally...
    call npm i -g tiktok-live-recorder
)

where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo [recorder] ffmpeg not found. Download a static build from:
    echo            https://www.gyan.dev/ffmpeg/builds/
    echo            then add the bin folder to PATH.
    pause
    exit /b 1
)

set /p USERNAME=Enter the TikTok username (without @):
if "!USERNAME!"=="" (
    echo [recorder] No username entered. Exiting.
    pause
    exit /b 1
)

echo [recorder] starting record of @!USERNAME!  (Ctrl+C to stop)
tiktok-live-recorder !USERNAME!

echo.
echo [recorder] done.
pause
