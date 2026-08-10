"""
exporter.py
-----------
Writes completed scan results out to disk in TXT, CSV, or JSON format.
Each export includes the target, scan date, duration, the full port
list, service names, and summary statistics.
"""

from __future__ import annotations

import csv
import json
from dataclasses import asdict
from pathlib import Path
from typing import Iterable

from scanner import ScanResult
from utils import ensure_dir, now_stamp_for_filename


def _summary(target: str, results: Iterable[ScanResult], duration: float) -> dict:
    results = list(results)
    open_ports = [r for r in results if r.status == "open"]
    closed_ports = [r for r in results if r.status == "closed"]
    filtered_ports = [r for r in results if r.status not in ("open", "closed")]
    return {
        "target": target,
        "scan_date": results[0].scanned_at if results else "",
        "duration_seconds": round(duration, 2),
        "total_ports": len(results),
        "open_count": len(open_ports),
        "closed_count": len(closed_ports),
        "filtered_count": len(filtered_ports),
    }


def build_export_path(export_folder: str, target: str, fmt: str) -> Path:
    """Build a timestamped output path inside the configured export folder."""
    folder = ensure_dir(export_folder)
    safe_target = target.replace(":", "_").replace("/", "_")
    filename = f"ndportx_{safe_target}_{now_stamp_for_filename()}.{fmt}"
    return folder / filename


def export_txt(path: Path, target: str, results: list[ScanResult], duration: float) -> None:
    summary = _summary(target, results, duration)
    lines = [
        "NDPortX - Scan Report",
        "=" * 40,
        f"Target:        {summary['target']}",
        f"Scan date:     {summary['scan_date']}",
        f"Duration:      {summary['duration_seconds']}s",
        f"Total ports:   {summary['total_ports']}",
        f"Open ports:    {summary['open_count']}",
        f"Closed ports:  {summary['closed_count']}",
        f"Filtered:      {summary['filtered_count']}",
        "-" * 40,
        "PORT     STATUS     SERVICE          BANNER",
    ]
    for r in results:
        banner = (r.banner or "")[:40]
        lines.append(f"{r.port:<8} {r.status:<10} {r.service:<16} {banner}")
    path.write_text("\n".join(lines), encoding="utf-8")


def export_csv(path: Path, target: str, results: list[ScanResult], duration: float) -> None:
    summary = _summary(target, results, duration)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["# Target", summary["target"]])
        writer.writerow(["# Scan date", summary["scan_date"]])
        writer.writerow(["# Duration (s)", summary["duration_seconds"]])
        writer.writerow(["# Open", summary["open_count"]])
        writer.writerow(["# Closed", summary["closed_count"]])
        writer.writerow(["# Filtered", summary["filtered_count"]])
        writer.writerow([])
        writer.writerow(["Port", "Status", "Service", "Banner", "Response Time (ms)"])
        for r in results:
            writer.writerow([r.port, r.status, r.service, r.banner or "", r.response_ms])


def export_json(path: Path, target: str, results: list[ScanResult], duration: float) -> None:
    summary = _summary(target, results, duration)
    data = {
        "summary": summary,
        "results": [asdict(r) for r in results],
    }
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


EXPORTERS = {
    "txt": export_txt,
    "csv": export_csv,
    "json": export_json,
}


def export_results(
    export_folder: str,
    target: str,
    results: list[ScanResult],
    duration: float,
    fmt: str,
) -> Path:
    """Export results in the requested format and return the file path."""
    fmt = fmt.lower().lstrip(".")
    if fmt not in EXPORTERS:
        raise ValueError(f"Unsupported export format: {fmt}")
    path = build_export_path(export_folder, target, fmt)
    EXPORTERS[fmt](path, target, results, duration)
    return path
