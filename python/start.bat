@echo off
REM tiktok-live-recorder (Python) - Windows one-click launcher
setlocal enabledelayedexpansion

where python >nul 2>&1
if errorlevel 1 (
    echo [recorder] Python is not installed. Get it from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [recorder] Updating tiktok-live-recorder...
call python -m pip install --user --upgrade tiktok-live-recorder >nul 2>&1
if errorlevel 1 (
    echo [recorder] pip install failed. Continuing with existing install if present.
)

where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo [recorder] ffmpeg not found. Download a static build from:
    echo            https://www.gyan.dev/ffmpeg/builds/
    echo            then add the bin folder to PATH.
    pause
    exit /b 1
)

set /p TTUSER=Enter the TikTok username (without @):
if "!TTUSER!"=="" (
    echo [recorder] No username entered. Exiting.
    pause
    exit /b 1
)

echo [recorder] starting record of @!TTUSER!  (Ctrl+C to stop)
where tiktok-live-recorder >nul 2>&1
if errorlevel 1 (
    call python -m tiktok_live_recorder.cli !TTUSER!
) else (
    call tiktok-live-recorder !TTUSER!
)

echo.
echo [recorder] done.
pause
