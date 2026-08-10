"""
utils.py
--------
Small, reusable helper functions shared across the NDPortX
codebase. Keeping these in one place avoids duplicate logic in the
GUI, scanner, exporter, and logger modules.
"""

from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path


def format_duration(seconds: float) -> str:
    """Format a duration in seconds as H:MM:SS or M:SS."""
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours:d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:d}:{secs:02d}"


def format_speed(ports_scanned: int, elapsed: float) -> str:
    """Return a human readable ports/sec figure."""
    if elapsed <= 0:
        return "0.0 ports/s"
    return f"{ports_scanned / elapsed:.1f} ports/s"


def now_str() -> str:
    """Current local timestamp, e.g. 2026-08-06 14:32:10."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def now_stamp_for_filename() -> str:
    """Filesystem-safe timestamp for building export/log filenames."""
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def ensure_dir(path: str | Path) -> Path:
    """Create a directory (and parents) if it doesn't already exist."""
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def eta_seconds(done: int, total: int, elapsed: float) -> float:
    """Estimate remaining seconds based on progress so far."""
    if done <= 0:
        return 0.0
    rate = done / elapsed if elapsed > 0 else 0
    remaining = total - done
    return remaining / rate if rate > 0 else 0.0


class Stopwatch:
    """Tiny stopwatch used by the scanner to track elapsed time."""

    def __init__(self) -> None:
        self._start = 0.0
        self._running = False

    def start(self) -> None:
        self._start = time.time()
        self._running = True

    def stop(self) -> None:
        self._running = False

    def elapsed(self) -> float:
        if not self._running:
            return 0.0
        return time.time() - self._start
