<div align="center">

# tiktok-live-recorder

**Record any TikTok LIVE stream to MP4 in one command. Node.js + Python.**

CLI + SDK. HLS + FLV input. Uses `ffmpeg` under the hood. 2026 edition.

</div>

---

## SDKs

- **Node.js + TypeScript** → [`node/`](node/) ([npm: `tiktok-live-recorder`](https://www.npmjs.com/package/tiktok-live-recorder))
- **Python** → [`python/`](python/) ([PyPI: `tiktok-live-recorder`](https://pypi.org/project/tiktok-live-recorder/))

Each SDK exposes the same shape: a `TikTokLiveRecorder` class + `tiktok-live-recorder` CLI. Pick the language that matches your stack.

---

## Quick start

### Node.js

```bash
npm i -g tiktok-live-recorder
tiktok-live-recorder streamer_username --api-key YOUR_KEY
```

Or programmatic:

```ts
import { TikTokLiveRecorder } from 'tiktok-live-recorder';

const rec = new TikTokLiveRecorder('streamer', { apiKey: process.env.TIKTOOL_API_KEY });
const { outFile, durationSec } = await rec.record({ maxDurationSec: 3600 });
console.log(`Saved ${outFile} (${durationSec}s)`);
```

### Python

```bash
pip install tiktok-live-recorder
tiktok-live-recorder streamer_username --api-key YOUR_KEY
```

Or programmatic:

```python
from tiktok_live_recorder import TikTokLiveRecorder

rec = TikTokLiveRecorder('streamer', api_key='...')
out_file, duration = rec.record(max_duration_sec=3600)
print(f'Saved {out_file} ({duration}s)')
```

### One-click

- **Windows** - download [`node/start.bat`](node/start.bat), double-click, enter username.
- **macOS / Linux**:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/tiktool/tiktok-live-recorder/main/node/start.sh | bash
  ```

`ffmpeg` must be on PATH:
- **Windows**: <https://www.gyan.dev/ffmpeg/builds/>
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg` (Debian/Ubuntu) or `sudo dnf install ffmpeg` (Fedora).

---

## How it works

1. The recorder asks `https://api.tik.tools/webcast/room_video` for the user's current HLS / FLV URLs.
2. The server checks live status + returns the URLs as JSON.
3. The recorder spawns local `ffmpeg`, copies the bytes to disk. No re-encoding.

All bandwidth flows directly from TikTok's CDN to your disk - none of it touches our servers.

---

## Full reference

- **[node/README.md](node/README.md)** - Node.js CLI + SDK
- **[python/README.md](python/README.md)** - Python CLI + SDK

---

## License

MIT

> This is an independent third-party project. Not affiliated with, endorsed by, or in any way officially connected to TikTok or ByteDance Ltd. "TikTok" is a trademark of ByteDance Ltd; the name appears here for search discoverability.
