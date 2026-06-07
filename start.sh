#!/usr/bin/env bash
# tiktok-live-recorder - macOS / Linux one-click launcher.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
    echo "[recorder] Node.js is not installed. Get it from https://nodejs.org/"
    exit 1
fi

if ! command -v tiktok-live-recorder >/dev/null 2>&1; then
    echo "[recorder] Installing tiktok-live-recorder globally..."
    npm i -g tiktok-live-recorder
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "[recorder] ffmpeg is missing. Install it:"
    echo "  macOS:    brew install ffmpeg"
    echo "  Linux:    sudo apt install ffmpeg  (Debian/Ubuntu)"
    echo "            sudo dnf install ffmpeg  (Fedora)"
    exit 1
fi

read -rp "Enter the TikTok username (without @): " USERNAME
if [[ -z "${USERNAME}" ]]; then
    echo "[recorder] No username entered. Exiting."
    exit 1
fi

echo "[recorder] starting record of @${USERNAME}  (Ctrl+C to stop)"
tiktok-live-recorder "$USERNAME"
