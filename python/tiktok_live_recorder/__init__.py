"""tiktok-live-recorder

Capture any TikTok LIVE stream to a local MP4 file. One method, one
username, one MP4 on your disk. Uses ffmpeg under the hood.

Example::

    from tiktok_live_recorder import TikTokLiveRecorder

    rec = TikTokLiveRecorder("streamer")
    out_file, duration = rec.record(quality="origin")
    print(f"Saved {out_file} ({duration}s)")
"""

from .recorder import (
    TikTokLiveRecorder,
    StreamSources,
    Quality,
    Container,
    StreamOfflineError,
    FfmpegMissingError,
)

__version__ = "1.0.0"

__all__ = [
    "TikTokLiveRecorder",
    "StreamSources",
    "Quality",
    "Container",
    "StreamOfflineError",
    "FfmpegMissingError",
    "__version__",
]
