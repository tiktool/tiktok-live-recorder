@echo off
REM tiktok-live-recorder - Windows one-click launcher
setlocal enabledelayedexpansion

where node >nul 2>&1
if errorlevel 1 (
    echo [recorder] Node.js is not installed. Get it from https://nodejs.org/
    pause
    exit /b 1
)

echo [recorder] Updating tiktok-live-recorder...
call npm i -g tiktok-live-recorder@latest >nul 2>&1
if errorlevel 1 (
    echo [recorder] Global install failed. Will use npx.
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
    call npx -y tiktok-live-recorder !TTUSER!
) else (
    call tiktok-live-recorder !TTUSER!
)

echo.
echo [recorder] done.
pause
