#!/usr/bin/env bash
# tiktok-live-recorder - macOS / Linux one-click launcher.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
    echo "[recorder] Node.js is not installed. Get it from https://nodejs.org/"
    exit 1
fi

echo "[recorder] Updating tiktok-live-recorder..."
npm i -g tiktok-live-recorder@latest || echo "[recorder] global install failed - will use npx"

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
    # Piped from curl - read from controlling terminal.
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
tiktok-live-recorder "$TTUSER"
