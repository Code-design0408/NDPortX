"""
logger.py
---------
File-based logging for NDPortX. Every scan (successful or
not) is appended to a rotating daily log file under logs/, and any
unexpected exceptions are logged as well so issues can be diagnosed
after the fact.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from utils import ensure_dir

LOG_DIR = Path(__file__).parent / "logs"


def get_logger() -> logging.Logger:
    """Return a configured logger that writes to logs/YYYY-MM-DD.log."""
    ensure_dir(LOG_DIR)
    log_file = LOG_DIR / f"{datetime.now().strftime('%Y-%m-%d')}.log"

    logger = logging.getLogger("ndportx")
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.FileHandler(log_file, encoding="utf-8")
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)-7s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger


def log_scan_start(target: str, start_port: int, end_port: int) -> None:
    log = get_logger()
    log.info(f"SCAN START target={target} ports={start_port}-{end_port}")


def log_scan_complete(
    target: str,
    duration: float,
    open_ports: list[int],
    total_ports: int,
) -> None:
    log = get_logger()
    log.info(
        f"SCAN COMPLETE target={target} duration={duration:.2f}s "
        f"total_ports={total_ports} open={len(open_ports)} "
        f"open_ports={open_ports}"
    )


def log_scan_stopped(target: str, ports_completed: int, total_ports: int) -> None:
    log = get_logger()
    log.warning(
        f"SCAN STOPPED target={target} progress={ports_completed}/{total_ports}"
    )


def log_error(context: str, error: Exception) -> None:
    log = get_logger()
    log.error(f"ERROR in {context}: {error!r}")
