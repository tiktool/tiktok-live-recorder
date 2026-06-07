<div align="center">

# tiktok-live-recorder

**Record any TikTok LIVE stream to MP4 in one command.**

CLI + SDK. HLS + FLV input. Uses `ffmpeg` under the hood. Schedule, monitor, auto-archive. 2026 edition.

[![npm](https://img.shields.io/npm/v/tiktok-live-recorder)](https://www.npmjs.com/package/tiktok-live-recorder)
[![downloads](https://img.shields.io/npm/dm/tiktok-live-recorder)](https://www.npmjs.com/package/tiktok-live-recorder)
[![license](https://img.shields.io/npm/l/tiktok-live-recorder)](LICENSE)

</div>

---

## Three ways to use it

### 1. One-click (Windows)

Download [`start.bat`](start.bat), double-click. It installs the package + prompts for a username. Records the live to MP4 in the current folder.

### 2. One-click (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/tiktool/tiktok-live-recorder/main/start.sh | bash
```

### 3. CLI

```bash
npm i -g tiktok-live-recorder
tiktok-live-recorder streamer_username
```

### 4. Programmatic

```ts
import { TikTokLiveRecorder } from 'tiktok-live-recorder';

const rec = new TikTokLiveRecorder('streamer_username');
const { outFile, durationSec } = await rec.record({ quality: 'origin', maxDurationSec: 3600 });
console.log(`Saved ${durationSec}s to ${outFile}`);
```

---

## Install

```bash
# CLI + library
npm i -g tiktok-live-recorder

# library only (programmatic use)
npm install tiktok-live-recorder
```

`ffmpeg` must be on PATH:
- **Windows**: download from <https://www.gyan.dev/ffmpeg/builds/> and add `bin` to PATH.
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg` (Debian/Ubuntu) or `sudo dnf install ffmpeg` (Fedora).

---

## CLI

```text
tiktok-live-recorder <username> [options]

Options:
  -o, --out <file>         Output file (default: <username>-<timestamp>.mp4)
  -q, --quality <q>        origin | FULL_HD1 | HD1 | SD1 | SD2  (default: origin)
  -c, --container <ext>    mp4 | flv | ts | mkv  (default: mp4)
      --max <seconds>      Stop after N seconds
      --api-key <key>      Use a tik.tools API key (optional)
  -v, --verbose            Print ffmpeg output
  -h, --help               Show this help
```

Examples:

```bash
# Record at best quality
tiktok-live-recorder streamer

# Cap at 2 hours, save to a named file
tiktok-live-recorder streamer --out 2026-06-07.mp4 --max 7200

# Save as FLV (no remux)
tiktok-live-recorder streamer -q origin -c flv

# Verbose ffmpeg output
tiktok-live-recorder streamer -v
```

The CLI exits with code `2` when the user is offline so you can chain it in a watcher script:

```bash
while ! tiktok-live-recorder streamer; do sleep 30; done
```

---

## SDK

### Quick start

```ts
import { TikTokLiveRecorder } from 'tiktok-live-recorder';

const rec = new TikTokLiveRecorder('streamer');
const { outFile, durationSec } = await rec.record();
console.log(`Wrote ${outFile} (${durationSec}s)`);
```

### Constructor

```ts
new TikTokLiveRecorder(uniqueId, options?)
```

| Option | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | `https://api.tik.tools/webcast/stream_url` | Override the URL resolver. |
| `apiKey` | `string` | - | Optional API key for higher-quality endpoints. |

### `rec.resolve(): Promise<StreamSources>`

Returns the available HLS / FLV URLs for the user without starting a recording.

```ts
const { live, hls, flv, title } = await rec.resolve();
if (!live) console.log('@user is offline.');
else console.log('HLS origin:', hls?.origin);
```

### `rec.record(options): Promise<{ outFile, durationSec }>`

Capture to disk. Resolves when the stream goes offline, `maxDurationSec` hits, or the user hits Ctrl+C.

| Option | Type | Default | Description |
|---|---|---|---|
| `outFile` | `string` | `<uniqueId>-<timestamp>.mp4` | Output path. |
| `quality` | `Quality` | `'origin'` | Preferred quality. Falls back to next available. |
| `container` | `Container` | `'mp4'` | `mp4` / `flv` / `ts` / `mkv`. |
| `ffmpegPath` | `string` | `'ffmpeg'` | Override the ffmpeg binary location. |
| `rotateEverySec` | `number` | - | Auto-rotate segment files every N seconds (planned). |
| `maxDurationSec` | `number` | - | Stop after N seconds. |
| `verbose` | `boolean` | `false` | Pipe ffmpeg stderr to stdout. |
| `onSegmentStart` | `(path) => void` | - | Callback when a new segment file starts. |
| `onSegmentEnd` | `(path) => void` | - | Callback when a segment file closes. |

### Errors

```ts
import { StreamOfflineError, FfmpegMissingError } from 'tiktok-live-recorder';

try {
    await rec.record();
} catch (e) {
    if (e instanceof StreamOfflineError) console.log('not live');
    else if (e instanceof FfmpegMissingError) console.log('install ffmpeg');
    else throw e;
}
```

---

## Recipes

### Watch + record (poll every 30s, record automatically)

```ts
import { TikTokLiveRecorder, StreamOfflineError } from 'tiktok-live-recorder';

const rec = new TikTokLiveRecorder('streamer');

while (true) {
    try {
        const { outFile } = await rec.record();
        console.log(`captured ${outFile}`);
    } catch (e) {
        if (!(e instanceof StreamOfflineError)) throw e;
    }
    await new Promise(r => setTimeout(r, 30_000));
}
```

### Batch record multiple creators

```ts
import { TikTokLiveRecorder, StreamOfflineError } from 'tiktok-live-recorder';

const usernames = ['a', 'b', 'c', 'd'];

await Promise.all(usernames.map(async (u) => {
    const rec = new TikTokLiveRecorder(u);
    try { await rec.record({ outFile: `${u}.mp4` }); }
    catch (e) { if (!(e instanceof StreamOfflineError)) console.error(u, e); }
}));
```

### Time-capped clip

```ts
import { TikTokLiveRecorder } from 'tiktok-live-recorder';

const rec = new TikTokLiveRecorder('streamer');
await rec.record({ maxDurationSec: 60, outFile: 'clip.mp4' });
```

### Custom ffmpeg pipeline (split segments)

```ts
import { TikTokLiveRecorder } from 'tiktok-live-recorder';
import { spawn } from 'child_process';

const rec = new TikTokLiveRecorder('streamer');
const { hls } = await rec.resolve();
if (!hls?.origin) throw new Error('no hls available');

spawn('ffmpeg', [
    '-i', hls.origin,
    '-c', 'copy',
    '-f', 'segment',
    '-segment_time', '600',
    '-reset_timestamps', '1',
    'streamer-%03d.mp4',
], { stdio: 'inherit' });
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

- **Node.js >= 18** (native `fetch`, ES2022).
- Works on Windows, macOS, Linux, Docker.
- ESM + CommonJS dual published.
- Requires `ffmpeg` on PATH.

---

## License

MIT

> This is an independent third-party project. Not affiliated with, endorsed by, or in any way officially connected to TikTok or ByteDance Ltd. "TikTok" is a trademark of ByteDance Ltd; the name appears here for search discoverability.
