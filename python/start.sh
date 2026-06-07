#!/usr/bin/env bash
# tiktok-live-recorder (Python) - macOS / Linux one-click launcher.
set -euo pipefail

PY="python3"
if ! command -v "$PY" >/dev/null 2>&1; then
    if command -v python >/dev/null 2>&1; then PY="python"; else
        echo "[recorder] Python is not installed. Get it from https://www.python.org/downloads/"
        exit 1
    fi
fi

echo "[recorder] Updating tiktok-live-recorder..."
"$PY" -m pip install --user --upgrade tiktok-live-recorder >/dev/null 2>&1 || echo "[recorder] pip install failed - using existing if present"

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "[recorder] ffmpeg is missing. Install it:"
    echo "  macOS:    brew install ffmpeg"
    echo "  Linux:    sudo apt install ffmpeg  (Debian/Ubuntu)"
    echo "            sudo dnf install ffmpeg  (Fedora)"
    exit 1
fi

if [[ -t 0 ]]; then
    read -rp "Enter the TikTok username (without @): " TTUSER
else
    if [[ -r /dev/tty ]]; then
        printf 'Enter the TikTok username (without @): ' > /dev/tty
        read -r TTUSER < /dev/tty
    else
        echo "[recorder] No TTY available. Run: tiktok-live-recorder <username>"
        exit 1
    fi
fi

if [[ -z "${TTUSER:-}" ]]; then
    echo "[recorder] No username entered. Exiting."
    exit 1
fi

echo "[recorder] starting record of @${TTUSER}  (Ctrl+C to stop)"
if command -v tiktok-live-recorder >/dev/null 2>&1; then
    tiktok-live-recorder "$TTUSER"
else
    "$PY" -m tiktok_live_recorder.cli "$TTUSER"
fi
