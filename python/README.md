<div align="center">

# tiktok-live-recorder

**Record any TikTok LIVE stream to MP4 in one command.**

CLI + Python SDK. HLS + FLV input. Uses `ffmpeg` under the hood. Schedule, monitor, auto-archive. 2026 edition.

[![pypi](https://img.shields.io/pypi/v/tiktok-live-recorder)](https://pypi.org/project/tiktok-live-recorder/)
[![downloads](https://img.shields.io/pypi/dm/tiktok-live-recorder)](https://pypi.org/project/tiktok-live-recorder/)
[![python](https://img.shields.io/pypi/pyversions/tiktok-live-recorder)](https://pypi.org/project/tiktok-live-recorder/)
[![license](https://img.shields.io/pypi/l/tiktok-live-recorder)](LICENSE)

</div>

---

## Install

```bash
pip install tiktok-live-recorder
```

`ffmpeg` must be on PATH:
- **Windows**: download from <https://www.gyan.dev/ffmpeg/builds/> and add `bin` to PATH.
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg` (Debian/Ubuntu) or `sudo dnf install ffmpeg` (Fedora).

---

## CLI

```bash
tiktok-live-recorder streamer_username
```

No key required to get going. Drop `--api-key YOUR_KEY` (free at <https://tik.tools>) to lift the per-IP caps if you record more than a few clips per hour.

```text
tiktok-live-recorder <username> [options]

Options:
  -o, --out <file>         Output file (default: <username>-<timestamp>.mp4)
  -q, --quality <q>        origin | FULL_HD1 | HD1 | SD1 | SD2  (default: origin)
  -c, --container <ext>    mp4 | flv | ts | mkv  (default: mp4)
      --max <seconds>      Stop after N seconds
      --api-key <key>      Use a tik.tools API key (optional)
  -v, --verbose            Print ffmpeg output
```

Examples:

```bash
# Record at best quality
tiktok-live-recorder streamer

# Cap at 2 hours, save to a named file
tiktok-live-recorder streamer --out 2026-06-07.mp4 --max 7200

# Save as FLV (no remux)
tiktok-live-recorder streamer -q origin -c flv

# Run as a module
python -m tiktok_live_recorder streamer
```

The CLI exits with code `2` when the user is offline so you can chain it in a watcher script:

```bash
while ! tiktok-live-recorder streamer; do sleep 30; done
```

---

## SDK

### Quick start

```python
from tiktok_live_recorder import TikTokLiveRecorder

rec = TikTokLiveRecorder("streamer")
out_file, duration = rec.record(quality="origin")
print(f"Wrote {out_file} ({duration}s)")
```

### Constructor

```python
TikTokLiveRecorder(unique_id, *, endpoint=STREAM_URL_ENDPOINT, api_key="")
```

| Argument | Type | Default | Description |
|---|---|---|---|
| `unique_id` | `str` | - | TikTok username (with or without `@`). |
| `endpoint` | `str` | `https://api.tik.tools/webcast/stream_url` | Override the URL resolver. |
| `api_key` | `str` | `""` | Optional API key for higher-quality endpoints. |

### `rec.resolve() -> StreamSources`

Return the available HLS / FLV URLs for the user without starting a recording.

```python
sources = rec.resolve()
if not sources.live:
    print("offline")
else:
    print("HLS origin:", sources.hls.get("origin"))
```

### `rec.record(...) -> tuple[str, int]`

Capture to disk. Returns `(out_file, duration_sec)`. Resolves when the stream goes offline, `max_duration_sec` hits, or the user hits Ctrl+C.

| Argument | Type | Default | Description |
|---|---|---|---|
| `out_file` | `str | None` | `<uniqueId>-<timestamp>.mp4` | Output path. |
| `quality` | `str` | `"origin"` | Preferred quality. Falls back to next available. |
| `container` | `str` | `"mp4"` | `mp4` / `flv` / `ts` / `mkv`. |
| `ffmpeg_path` | `str` | `"ffmpeg"` | Override the ffmpeg binary location. |
| `max_duration_sec` | `int | None` | - | Stop after N seconds. |
| `verbose` | `bool` | `False` | Print ffmpeg stderr. |
| `on_segment_start` | `Callable[[str], None]` | - | Callback when a new segment file starts. |
| `on_segment_end` | `Callable[[str], None]` | - | Callback when a segment file closes. |

### Errors

```python
from tiktok_live_recorder import (
    TikTokLiveRecorder,
    StreamOfflineError,
    FfmpegMissingError,
)

rec = TikTokLiveRecorder("streamer")
try:
    rec.record()
except StreamOfflineError:
    print("not live")
except FfmpegMissingError:
    print("install ffmpeg")
```

---

## Recipes

### Watch + record (poll every 30s)

```python
import time
from tiktok_live_recorder import TikTokLiveRecorder, StreamOfflineError

rec = TikTokLiveRecorder("streamer")

while True:
    try:
        out_file, duration = rec.record()
        print(f"captured {out_file} ({duration}s)")
    except StreamOfflineError:
        print("offline, retry in 30s")
    time.sleep(30)
```

### Batch record multiple creators concurrently

```python
import concurrent.futures
from tiktok_live_recorder import TikTokLiveRecorder, StreamOfflineError

USERNAMES = ["a", "b", "c"]

def record_one(u: str) -> str:
    try:
        out_file, _ = TikTokLiveRecorder(u).record(out_file=f"{u}.mp4")
        return f"{u} -> {out_file}"
    except StreamOfflineError:
        return f"{u} offline"

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
    for r in ex.map(record_one, USERNAMES):
        print(r)
```

### Time-capped clip

```python
from tiktok_live_recorder import TikTokLiveRecorder

rec = TikTokLiveRecorder("streamer")
out_file, _ = rec.record(max_duration_sec=60, out_file="clip.mp4")
```

### Custom ffmpeg pipeline (split into 10-min segments)

```python
import subprocess
from tiktok_live_recorder import TikTokLiveRecorder

sources = TikTokLiveRecorder("streamer").resolve()
input_url = sources.hls.get("origin")
if not input_url:
    raise SystemExit("no hls available")

subprocess.run([
    "ffmpeg", "-i", input_url,
    "-c", "copy",
    "-f", "segment",
    "-segment_time", "600",
    "-reset_timestamps", "1",
    "streamer-%03d.mp4",
])
```

More ready-to-run recipes in [`examples/`](examples/).

---

## How it works

1. The recorder asks `https://api.tik.tools/webcast/stream_url?uniqueId=X` for the user's current HLS / FLV URLs.
2. The server checks live status + returns the URLs as JSON.
3. The recorder spawns local `ffmpeg`, passes the URL as input, copies the bytes to disk. No re-encoding.

All bandwidth flows directly from TikTok's CDN to your disk - none of it touches our servers. We only handle the lightweight URL resolution.

---

## Compatibility

- **Python >= 3.9**.
- Works on Windows, macOS, Linux, Docker.
- Requires `ffmpeg` on PATH.

---

## License

MIT

> This is an independent third-party project. Not affiliated with, endorsed by, or in any way officially connected to TikTok or ByteDance Ltd. "TikTok" is a trademark of ByteDance Ltd; the name appears here for search discoverability.
