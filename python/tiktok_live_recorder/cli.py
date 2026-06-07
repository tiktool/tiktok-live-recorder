"""tiktok-live-recorder CLI entry point."""

from __future__ import annotations

import argparse
import sys
from typing import Optional

from .recorder import (
    TikTokLiveRecorder,
    StreamOfflineError,
    FfmpegMissingError,
)


def _parse_args(argv: Optional[list[str]]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="tiktok-live-recorder",
        description="Record any TikTok LIVE stream to MP4 in one command.",
    )
    p.add_argument("username", help="TikTok username to record (with or without @).")
    p.add_argument("-o", "--out", dest="out_file", help="Output file path.")
    p.add_argument("-q", "--quality", default="origin",
                   choices=["origin", "FULL_HD1", "HD1", "SD1", "SD2"],
                   help="Preferred quality (default: origin).")
    p.add_argument("-c", "--container", default="mp4",
                   choices=["mp4", "flv", "ts", "mkv"],
                   help="Output container (default: mp4).")
    p.add_argument("--max", dest="max_seconds", type=int, default=None,
                   help="Stop recording after N seconds.")
    p.add_argument("--api-key", dest="api_key", default="",
                   help="Optional tik.tools API key.")
    p.add_argument("-v", "--verbose", action="store_true",
                   help="Print ffmpeg output.")
    return p.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = _parse_args(argv)
    username = args.username.lstrip("@").strip()
    print(f"[recorder] resolving @{username} ...")

    rec = TikTokLiveRecorder(username, api_key=args.api_key)
    try:
        out_file, duration = rec.record(
            out_file=args.out_file,
            quality=args.quality,
            container=args.container,
            max_duration_sec=args.max_seconds,
            verbose=args.verbose,
            on_segment_start=lambda p: print(f"[recorder] recording -> {p}"),
            on_segment_end=lambda p: print(f"[recorder] finalised {p}"),
        )
    except StreamOfflineError as e:
        print(f"[recorder] @{e.unique_id} is not currently live.", file=sys.stderr)
        return 2
    except FfmpegMissingError:
        print("[recorder] ffmpeg is missing. Install it from https://ffmpeg.org/download.html",
              file=sys.stderr)
        return 3
    except Exception as e:
        print(f"[recorder] failed: {e}", file=sys.stderr)
        return 1

    print(f"[recorder] done. duration {duration}s, file {out_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
