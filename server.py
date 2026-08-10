"""
server.py
---------
Flask web server for NDPortX. Wraps the same threaded
scan engine (scanner.py) used by the desktop version, but exposes it
over HTTP so it can be hosted (e.g. on Render) and used from any
browser.

Endpoints:
    GET  /                          -> the dashboard page
    GET  /api/presets                -> port range presets
    POST /api/scan                   -> start a scan, returns {scan_id}
    GET  /api/scan/<id>/stream       -> Server-Sent Events progress/results
    POST /api/scan/<id>/stop         -> stop a running scan
    GET  /api/scan/<id>/export?fmt=  -> download results as txt/csv/json

Safety limits (since this can be reached by anyone with the URL):
    - max ports per scan
    - max threads per scan
    - max concurrent scans across all users
See MAX_PORTS_PER_SCAN / MAX_THREADS / MAX_CONCURRENT_SCANS below.
"""

from __future__ import annotations

import json
import queue
import threading
import time
import uuid
from dataclasses import asdict

from flask import Flask, Response, jsonify, render_template, request, send_file

from exporter import export_results, build_export_path
from logger import log_error, log_scan_complete, log_scan_start, log_scan_stopped
from scanner import PortScanner, ScanResult
from services import PRESETS
from utils import ensure_dir
from validator import (
    validate_port_range,
    validate_target,
    validate_threads,
    validate_timeout,
)

app = Flask(__name__)

# --- Hosted-safety limits --------------------------------------------------
MAX_PORTS_PER_SCAN = 3000
MAX_THREADS = 150
MAX_CONCURRENT_SCANS = 4
SCAN_TTL_SECONDS = 60 * 30  # drop finished scan state after 30 minutes

EXPORT_DIR = ensure_dir("exports")

# In-memory scan registry: scan_id -> state dict
_scans: dict[str, dict] = {}
_scans_lock = threading.Lock()


def _active_scan_count() -> int:
    with _scans_lock:
        return sum(1 for s in _scans.values() if s["status"] == "running")


def _cleanup_old_scans() -> None:
    cutoff = time.time() - SCAN_TTL_SECONDS
    with _scans_lock:
        stale = [sid for sid, s in _scans.items()
                 if s["status"] != "running" and s.get("finished_at", 0) < cutoff]
        for sid in stale:
            del _scans[sid]


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@app.route("/")
def welcome():
    return render_template("index.html")


@app.route("/scanner")
def index():
    return render_template("index.html")


@app.route("/api/presets")
def api_presets():
    return jsonify({name: {"min": min(ports), "max": max(ports), "count": len(ports)}
                     for name, ports in PRESETS.items()})


# ---------------------------------------------------------------------------
# Scan lifecycle
# ---------------------------------------------------------------------------

@app.route("/api/scan", methods=["POST"])
def api_start_scan():
    _cleanup_old_scans()

    if _active_scan_count() >= MAX_CONCURRENT_SCANS:
        return jsonify({"error": "Server is at capacity. Please try again shortly."}), 429

    data = request.get_json(silent=True) or {}
    target_raw = str(data.get("target", "")).strip()
    start_port = data.get("start_port", 1)
    end_port = data.get("end_port", 1024)
    timeout = data.get("timeout", 0.5)
    threads = data.get("threads", 100)

    target_check = validate_target(target_raw)
    if not target_check.is_valid:
        return jsonify({"error": target_check.message}), 400

    ok, msg = validate_port_range(start_port, end_port)
    if not ok:
        return jsonify({"error": msg}), 400
    ok, msg = validate_timeout(timeout)
    if not ok:
        return jsonify({"error": msg}), 400
    ok, msg = validate_threads(threads)
    if not ok:
        return jsonify({"error": msg}), 400

    start_port, end_port = int(start_port), int(end_port)
    timeout = float(timeout)
    threads = min(int(threads), MAX_THREADS)

    if (end_port - start_port + 1) > MAX_PORTS_PER_SCAN:
        return jsonify({
            "error": f"This hosted instance limits scans to {MAX_PORTS_PER_SCAN} "
                     f"ports at a time. Narrow your range or run locally for larger scans."
        }), 400

    scan_id = uuid.uuid4().hex
    event_queue: queue.Queue = queue.Queue()

    state = {
        "status": "running",
        "target": target_raw,
        "resolved_ip": target_check.resolved_ip,
        "start_port": start_port,
        "end_port": end_port,
        "results": [],
        "duration": 0.0,
        "queue": event_queue,
        "finished_at": 0,
    }
    with _scans_lock:
        _scans[scan_id] = state

    log_scan_start(target_raw, start_port, end_port)

    def on_progress(done, total, elapsed):
        event_queue.put({"type": "progress", "done": done, "total": total, "elapsed": elapsed})

    def on_result(result: ScanResult):
        state["results"].append(result)
        event_queue.put({"type": "result", "result": asdict(result)})

    def on_done(results, duration, stopped):
        state["status"] = "stopped" if stopped else "complete"
        state["duration"] = duration
        state["finished_at"] = time.time()
        open_ports = [r.port for r in results if r.status == "open"]
        if stopped:
            log_scan_stopped(target_raw, len(results), end_port - start_port + 1)
        else:
            log_scan_complete(target_raw, duration, open_ports, len(results))
        event_queue.put({
            "type": "done", "duration": duration, "stopped": stopped,
            "open_count": len(open_ports), "total": len(results),
        })

    scanner = PortScanner(
        target_ip=target_check.resolved_ip,
        start_port=start_port,
        end_port=end_port,
        timeout=timeout,
        max_threads=threads,
        grab_banner=True,
        on_progress=on_progress,
        on_result=on_result,
        on_done=on_done,
    )
    state["scanner"] = scanner

    try:
        scanner.start()
    except Exception as exc:  # pragma: no cover - defensive
        log_error("scanner.start", exc)
        with _scans_lock:
            del _scans[scan_id]
        return jsonify({"error": f"Could not start scan: {exc}"}), 500

    return jsonify({"scan_id": scan_id, "resolved_ip": target_check.resolved_ip})


@app.route("/api/scan/<scan_id>/stream")
def api_scan_stream(scan_id: str):
    state = _scans.get(scan_id)
    if not state:
        return jsonify({"error": "Unknown scan_id"}), 404

    def generate():
        q: queue.Queue = state["queue"]
        yield "retry: 2000\n\n"
        while True:
            try:
                event = q.get(timeout=15)
            except queue.Empty:
                yield ": keepalive\n\n"
                continue
            yield f"data: {json.dumps(event)}\n\n"
            if event["type"] == "done":
                break

    return Response(generate(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


@app.route("/api/scan/<scan_id>/stop", methods=["POST"])
def api_scan_stop(scan_id: str):
    state = _scans.get(scan_id)
    if not state:
        return jsonify({"error": "Unknown scan_id"}), 404
    state["scanner"].stop()
    return jsonify({"ok": True})


@app.route("/api/scan/<scan_id>/export")
def api_scan_export(scan_id: str):
    state = _scans.get(scan_id)
    if not state:
        return jsonify({"error": "Unknown scan_id"}), 404

    fmt = request.args.get("fmt", "csv").lower()
    results: list[ScanResult] = state["results"]
    if not results:
        return jsonify({"error": "No results to export yet."}), 400

    try:
        path = export_results(str(EXPORT_DIR), state["target"], results, state["duration"], fmt)
    except Exception as exc:
        log_error("api_scan_export", exc)
        return jsonify({"error": str(exc)}), 400

    return send_file(path, as_attachment=True, download_name=path.name)


if __name__ == "__main__":
    # Local dev server. On Render, gunicorn runs `server:app` instead (see Procfile).
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
