<p align="center">
  <a href="https://discord.com/oauth2/authorize?client_id=1482386543233597470">
    <img src="https://img.shields.io/badge/Add%20TikTool%20Bot%20to%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Add TikTool Bot to Discord" height="46">
  </a>
</p>

Agency rank feeds in Discord: gaming ranks, creator ranks and 99+ movers across all 30 regions, copy-paste usernames for backstage. /ranks to start (Global Agency).

<div align="center">

# tiktok-live-recorder

**Record any TikTok LIVE stream to MP4 in one command. Node.js + Python.**

CLI + SDK. HLS + FLV input. Uses `ffmpeg` under the hood. 2026 edition.

</div>

---

## SDKs

- **Node.js + TypeScript** -> [`node/`](node/) ([npm: `tiktok-live-recorder`](https://www.npmjs.com/package/tiktok-live-recorder))
- **Python** -> [`python/`](python/) ([PyPI: `tiktok-live-recorder`](https://pypi.org/project/tiktok-live-recorder/))

Each SDK exposes the same shape: a `TikTokLiveRecorder` class + `tiktok-live-recorder` CLI. Pick the language that matches your stack.

---

## Quick start

### Node.js

```bash
npm i -g tiktok-live-recorder
tiktok-live-recorder streamer_username
```

Or programmatic:

```ts
import { TikTokLiveRecorder } from 'tiktok-live-recorder';

const rec = new TikTokLiveRecorder('streamer');
const { outFile, durationSec } = await rec.record({ maxDurationSec: 3600 });
console.log(`Saved ${outFile} (${durationSec}s)`);
```

### Python

```bash
pip install tiktok-live-recorder
tiktok-live-recorder streamer_username
```

Or programmatic:

```python
from tiktok_live_recorder import TikTokLiveRecorder

rec = TikTokLiveRecorder('streamer')
out_file, duration = rec.record(max_duration_sec=3600)
print(f'Saved {out_file} ({duration}s)')
```

No key. No config. Just run it.

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

## Pricing (USD)
| Tier | Weekly | Monthly |
|------|--------|---------|
| Sandbox / Free | $0 | $0 |
| Basic | $7 | $19 |
| Pro | $15 | $49 |
| Ultra | $45 | $149 |
| Global Agency | $119 | $399 |

Full pricing + checkout: https://tik.tools/pricing

## Tiers
Tier ladder (each includes everything below it): Sandbox -> Basic -> Pro -> Ultra -> Global Agency. Sandbox is free with reduced rate limits + masked identifiers on intelligence endpoints; paid tiers raise limits and unmask data. Outgoing webhooks need Basic+. The agency intelligence endpoints (gaming ranks, movers, eligible-creator finder, gifter intel) need Global Agency.

## Endpoints and required tier
| Endpoint | Min tier |
|---|---|
| POST /webcast/sign_url | Sandbox |
| POST /webcast/sign_websocket | Sandbox |
| GET /webcast/ws_credentials | Sandbox |
| GET /webcast/fetch | Sandbox |
| GET /webcast/room_id | Sandbox |
| GET /webcast/room_info | Sandbox |
| GET /webcast/room_video | Sandbox |
| GET /webcast/room_cover | Sandbox |
| GET /webcast/check_alive | Sandbox |
| POST /webcast/bulk_live_check | Sandbox |
| GET /webcast/live_status | Sandbox |
| GET /webcast/live-counts | Sandbox |
| POST /webcast/resolve_user_ids | Sandbox |
| GET /webcast/rankings | Sandbox |
| GET /webcast/leaderboard | Sandbox |
| GET /webcast/leaderboard/league | Sandbox |
| GET /webcast/leaderboard/leagues | Sandbox |
| GET /webcast/gift_info | Sandbox |
| GET /webcast/gift_gallery | Sandbox |
| GET /webcast/hashtag_list | Sandbox |
| GET /webcast/user_earnings | Sandbox |
| GET /webcast/live_analytics/video_list | Sandbox |
| GET /webcast/live_analytics/video_detail | Sandbox |
| GET /webcast/live_analytics/user_interactions | Sandbox |
| GET /webcast/rate_limits | Sandbox |
| POST /authentication/jwt | Sandbox |
| GET /api/live/connect | Sandbox |
| POST /chat-send | Basic |
| GET/POST /api/webhooks | Basic |
| POST /api/webhooks/{id}/test | Basic |
| GET /ws/sweep | Basic |
| GET /webcast/feed | Pro |
| POST /webcast/ranklist/regional | Pro |
| GET /webcast/user_profile | Pro |
| GET /api/leaderboards/country/:slug | Pro |
| GET /webcast/gifts_by_country | Ultra |
| GET /api/leaderboards/leagues/:region | Ultra |
| GET /api/leaderboards/league/:region/:classType | Ultra |
| GET /webcast/ranklist/gaming | Global Agency |
| GET /webcast/ranklist/gaming_movers | Global Agency |
| GET /webcast/ranklist/region_movers | Global Agency |
| GET /webcast/eligible_creators | Global Agency |
| GET /api/gifters/top | Global Agency |
| GET /api/gifters/leaderboard | Global Agency |
| GET /api/gifters/profile | Global Agency |

Full docs: https://tik.tools/docs

## What you get
**Creators**: real-time live events (gifts, chat, viewers), your own live status + room info, earnings + analytics, signed CDN/stream URLs that do not expire.
**Developers**: drop-in signing (works as a tiktok-live-connector backend - point the sign base at api.tik.tools), one-WebSocket fan-out (your IP never touches TikTok), bulk live checks, leaderboards, webhooks (HMAC-signed live.start/live.end and more), SDKs across languages.
**Agencies (Global Agency)**: TikTok LIVE gaming ranks + creator ranks + 99+ movers across all 30 regions, eligible-creator recruiting finder, gifter intelligence (top gifters, profiles, leaderboards), and the Discord bot that posts copy-paste username batches for backstage.

---

## License

MIT

> This is an independent third-party project. Not affiliated with, endorsed by, or in any way officially connected to TikTok or ByteDance Ltd. "TikTok" is a trademark of ByteDance Ltd; the name appears here for search discoverability.
