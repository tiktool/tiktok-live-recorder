"""TikTok LIVE stream recorder.

Resolves the HLS / FLV URLs for a TikTok username via the TikTools edge
and pipes the bytes through local ``ffmpeg`` into an MP4 (or FLV, MKV,
TS) file. No re-encoding.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional

STREAM_URL_ENDPOINT = "https://api.tik.tools/webcast/room_video"

Quality = str  # "origin" | "FULL_HD1" | "HD1" | "SD1" | "SD2"
Container = str  # "mp4" | "flv" | "ts" | "mkv"

logger = logging.getLogger("tiktok_live_recorder")


@dataclass
class StreamSources:
    """Result of :meth:`TikTokLiveRecorder.resolve`."""

    live: bool
    unique_id: str
    room_id: Optional[str] = None
    hls: Dict[str, str] = field(default_factory=dict)
    flv: Dict[str, str] = field(default_factory=dict)
    title: Optional[str] = None


class StreamOfflineError(RuntimeError):
    """Raised when the user is not currently broadcasting."""

    def __init__(self, unique_id: str) -> None:
        super().__init__(f"@{unique_id} is not currently live.")
        self.unique_id = unique_id


class FfmpegMissingError(RuntimeError):
    """Raised when no ``ffmpeg`` binary is found on PATH."""

    def __init__(self) -> None:
        super().__init__(
            "ffmpeg binary not found on PATH. Install ffmpeg from https://ffmpeg.org/download.html"
        )


class TikTokLiveRecorder:
    """Record a TikTok LIVE stream to disk.

    Example::

        from tiktok_live_recorder import TikTokLiveRecorder

        rec = TikTokLiveRecorder("streamer")
        out_file, duration = rec.record(quality="origin", max_duration_sec=3600)
        print(f"saved {out_file} ({duration}s)")
    """

    def __init__(
        self,
        unique_id: str,
        *,
        endpoint: str = STREAM_URL_ENDPOINT,
        api_key: str = "",
    ) -> None:
        self.unique_id = (unique_id or "").lstrip("@").strip()
        if not self.unique_id:
            raise ValueError("unique_id is required.")
        self.endpoint = endpoint
        # Anonymous mode is supported. Drop in a free key from
        # https://tik.tools to lift the per-IP caps when you hit them.
        self.api_key = (api_key or os.environ.get("TIKTOOL_API_KEY") or "").strip()

    # ── Resolution ────────────────────────────────────────────────

    def resolve(self) -> StreamSources:
        """Ask the TikTools edge for the user's current HLS / FLV URLs."""
        payload = json.dumps({"unique_id": self.unique_id}).encode("utf-8")
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        req = urllib.request.Request(
            self.endpoint,
            data=payload,
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                body = json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                try:
                    err_body = json.loads(e.read())
                    raise RuntimeError(err_body.get("error") or "Rate-limit reached, retry shortly.") from e
                except (json.JSONDecodeError, AttributeError):
                    pass
            raise RuntimeError(f"stream_url failed: HTTP {e.code}") from e
        except (urllib.error.URLError, OSError) as e:
            raise RuntimeError(f"stream_url unreachable: {e}") from e

        if isinstance(body, dict) and body.get("status_code") == -1 and body.get("error"):
            raise RuntimeError(f"stream_url: {body['error']}")

        data = body.get("data") if isinstance(body, dict) else None
        if not isinstance(data, dict):
            data = body if isinstance(body, dict) else {}

        hls: Dict[str, str] = {}
        flv: Dict[str, str] = {}
        for q, info in (data.get("stream_urls") or {}).items():
            if isinstance(info, dict):
                if info.get("flv"): flv[q] = info["flv"]
                if info.get("hls"): hls[q] = info["hls"]
        if data.get("flvPullUrl") and "default" not in flv:
            flv["default"] = data["flvPullUrl"]
        if data.get("hlsPullUrl") and "default" not in hls:
            hls["default"] = data["hlsPullUrl"]

        return StreamSources(
            live=bool(data.get("alive")),
            unique_id=self.unique_id,
            room_id=str(data.get("room_id") or "") or None,
            hls=hls,
            flv=flv,
            title=data.get("title"),
        )

    # ── Record ────────────────────────────────────────────────────

    def record(
        self,
        *,
        out_file: Optional[str] = None,
        quality: Quality = "origin",
        container: Container = "mp4",
        ffmpeg_path: str = "ffmpeg",
        max_duration_sec: Optional[int] = None,
        verbose: bool = False,
        on_segment_start: Optional[Callable[[str], None]] = None,
        on_segment_end: Optional[Callable[[str], None]] = None,
    ) -> tuple[str, int]:
        """Record the live stream to ``out_file``. Returns ``(out_file, duration_sec)``.

        Resolves when the stream goes offline, ``max_duration_sec`` hits,
        or the user sends SIGINT.
        """
        sources = self.resolve()
        if not sources.live:
            raise StreamOfflineError(self.unique_id)

        input_url = _pick_input(sources, quality)
        if not input_url:
            raise RuntimeError(f"No stream URL available for quality {quality!r}.")

        out_file = out_file or _default_out_name(self.unique_id, container)
        out_dir = os.path.dirname(os.path.abspath(out_file))
        if out_dir and not os.path.isdir(out_dir):
            os.makedirs(out_dir, exist_ok=True)

        if shutil.which(ffmpeg_path) is None:
            raise FfmpegMissingError()

        args = _build_ffmpeg_args(ffmpeg_path, input_url, out_file, container)
        if verbose:
            args.insert(1, "-stats")

        started = time.time()

        if on_segment_start:
            try: on_segment_start(out_file)
            except Exception: logger.exception("on_segment_start raised")

        proc = subprocess.Popen(
            args,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=None if verbose else subprocess.DEVNULL,
        )

        def _clean_quit() -> None:
            # ffmpeg's clean shutdown shortcut. Writes the mp4 moov atom
            # before exiting. SIGINT alone can leave an unfinalised file.
            try:
                if proc.stdin is not None:
                    proc.stdin.write(b"q\n")
                    proc.stdin.flush()
            except Exception:
                pass

        prev_sigint = signal.getsignal(signal.SIGINT)
        signal.signal(signal.SIGINT, lambda _s, _f: _clean_quit())

        try:
            if max_duration_sec and max_duration_sec > 0:
                try:
                    proc.wait(timeout=max_duration_sec)
                except subprocess.TimeoutExpired:
                    _clean_quit()
                    try:
                        proc.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        proc.terminate()
                        proc.wait(timeout=5)
            else:
                proc.wait()
        finally:
            try:
                signal.signal(signal.SIGINT, prev_sigint)
            except Exception:
                pass

        duration = int(time.time() - started)
        if on_segment_end:
            try: on_segment_end(out_file)
            except Exception: logger.exception("on_segment_end raised")

        return out_file, duration


# ── helpers ────────────────────────────────────────────────────────


def _pick_input(sources: StreamSources, preferred: Quality) -> Optional[str]:
    order = [preferred, "origin", "FULL_HD1", "HD1", "hd", "SD1", "ld", "SD2", "ao", "default"]
    for q in order:
        if q in sources.hls and sources.hls[q]:
            return sources.hls[q]
        if q in sources.flv and sources.flv[q]:
            return sources.flv[q]
    for v in sources.hls.values():
        if v:
            return v
    for v in sources.flv.values():
        if v:
            return v
    return None


def _build_ffmpeg_args(ffmpeg_path: str, input_url: str, out_file: str, container: Container) -> list[str]:
    base = [ffmpeg_path, "-hide_banner", "-loglevel", "warning", "-y", "-i", input_url]
    if container in ("flv", "ts"):
        base += ["-c", "copy", out_file]
    elif container == "mp4":
        base += ["-c", "copy", "-bsf:a", "aac_adtstoasc", "-movflags", "+faststart", out_file]
    else:
        base += ["-c", "copy", out_file]
    return base


def _default_out_name(unique_id: str, container: Container) -> str:
    ts = time.strftime("%Y-%m-%dT%H-%M-%S")
    return f"{unique_id}-{ts}.{container}"
