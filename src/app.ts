import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import express, { NextFunction, Request, Response } from "express";
import { exportResults } from "./exporter.js";
import {
  logError,
  logScanComplete,
  logScanStart,
  logScanStopped,
} from "./logger.js";
import { PortScanner, ScanResult } from "./scanner.js";
import { PRESETS } from "./services.js";
import { getAppJs, getStyleCss } from "./static-assets.js";
import { getIndexHtml, getWelcomeHtml } from "./templates.js";
import { ensureDir } from "./utils.js";
import {
  validatePortRange,
  validateTarget,
  validateThreads,
  validateTimeout,
} from "./validator.js";

export const app = express();

// Safety limits
const MAX_PORTS_PER_SCAN = 3000;
const MAX_THREADS = 150;
const MAX_CONCURRENT_SCANS = 4;
const SCAN_TTL_MS = 30 * 60 * 1000; // 30 minutes

const EXPORT_DIR = ensureDir(
  process.env.VERCEL
    ? path.join(os.tmpdir(), "ndportx-exports")
    : path.join(process.cwd(), "exports")
);

interface ScanState {
  scanId: string;
  status: "running" | "stopped" | "complete";
  target: string;
  resolved_ip: string;
  start_port: number;
  end_port: number;
  results: ScanResult[];
  duration: number;
  finished_at: number;
  scanner: PortScanner;
  eventHistory: any[];
  listeners: ((event: any) => void)[];
}

const scans = new Map<string, ScanState>();

function activeScanCount(): number {
  let count = 0;
  for (const s of scans.values()) {
    if (s.status === "running") count++;
  }
  return count;
}

function cleanupOldScans(): void {
  const cutoff = Date.now() - SCAN_TTL_MS;
  for (const [id, s] of scans.entries()) {
    if (s.status !== "running" && s.finished_at < cutoff) {
      scans.delete(id);
    }
  }
}

app.use(express.json());

// Serve static assets with fallback handlers
app.use("/static", express.static(path.join(process.cwd(), "static")));
app.use("/static", express.static(path.join(process.cwd(), "public", "static")));

app.get("/static/style.css", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/css; charset=utf-8");
  return res.send(getStyleCss());
});

app.get("/static/app.js", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  const js = getAppJs();
  if (js) return res.send(js);
  return res.sendFile(path.join(process.cwd(), "static", "app.js"));
});

// ---------------------------------------------------------------------------
// HTML Pages
// ---------------------------------------------------------------------------

app.get("/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(getWelcomeHtml());
});

app.get("/scanner", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(getIndexHtml());
});

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

app.get("/api/presets", (_req: Request, res: Response) => {
  const result: Record<string, { min: number; max: number; count: number }> = {};
  for (const [name, ports] of Object.entries(PRESETS)) {
    result[name] = {
      min: Math.min(...ports),
      max: Math.max(...ports),
      count: ports.length,
    };
  }
  res.json(result);
});

// ---------------------------------------------------------------------------
// Scan Lifecycle
// ---------------------------------------------------------------------------

app.post("/api/scan", async (req: Request, res: Response) => {
  cleanupOldScans();

  if (activeScanCount() >= MAX_CONCURRENT_SCANS) {
    return res
      .status(429)
      .json({ error: "Server is at capacity. Please try again shortly." });
  }

  const data = req.body || {};
  const targetRaw = String(data.target || "").trim();
  const startPortRaw = data.start_port ?? 1;
  const endPortRaw = data.end_port ?? 1024;
  const timeoutRaw = data.timeout ?? 0.5;
  const threadsRaw = data.threads ?? 100;

  const targetCheck = await validateTarget(targetRaw);
  if (!targetCheck.isValid || !targetCheck.resolvedIp) {
    return res.status(400).json({ error: targetCheck.message });
  }

  const [rangeOk, rangeMsg] = validatePortRange(startPortRaw, endPortRaw);
  if (!rangeOk) {
    return res.status(400).json({ error: rangeMsg });
  }

  const [timeoutOk, timeoutMsg] = validateTimeout(timeoutRaw);
  if (!timeoutOk) {
    return res.status(400).json({ error: timeoutMsg });
  }

  const [threadsOk, threadsMsg] = validateThreads(threadsRaw);
  if (!threadsOk) {
    return res.status(400).json({ error: threadsMsg });
  }

  const startPort = Number(startPortRaw);
  const endPort = Number(endPortRaw);
  const timeout = Number(timeoutRaw);
  const threads = Math.min(Number(threadsRaw), MAX_THREADS);

  if (endPort - startPort + 1 > MAX_PORTS_PER_SCAN) {
    return res.status(400).json({
      error: `This hosted instance limits scans to ${MAX_PORTS_PER_SCAN} ports at a time. Narrow your range or run locally for larger scans.`,
    });
  }

  const scanId = crypto.randomUUID().replace(/-/g, "");
  const resolvedIp = targetCheck.resolvedIp;

  const state: ScanState = {
    scanId,
    status: "running",
    target: targetRaw,
    resolved_ip: resolvedIp,
    start_port: startPort,
    end_port: endPort,
    results: [],
    duration: 0.0,
    finished_at: 0,
    scanner: null as any,
    eventHistory: [],
    listeners: [],
  };

  const broadcast = (event: any) => {
    state.eventHistory.push(event);
    for (const listener of [...state.listeners]) {
      try {
        listener(event);
      } catch (err) {
        // listener error ignored
      }
    }
  };

  logScanStart(targetRaw, startPort, endPort);

  const scanner = new PortScanner({
    targetIp: resolvedIp,
    startPort,
    endPort,
    timeout,
    maxThreads: threads,
    grabBanner: true,
    onProgress: (done, total, elapsed) => {
      broadcast({
        type: "progress",
        done,
        total,
        elapsed: Math.round(elapsed * 100) / 100,
      });
    },
    onResult: (result) => {
      state.results.push(result);
      broadcast({
        type: "result",
        result,
      });
    },
    onDone: (results, duration, stopped) => {
      state.status = stopped ? "stopped" : "complete";
      state.duration = Math.round(duration * 100) / 100;
      state.finished_at = Date.now();
      const openPorts = results.filter((r) => r.status === "open").map((r) => r.port);

      if (stopped) {
        logScanStopped(targetRaw, results.length, endPort - startPort + 1);
      } else {
        logScanComplete(targetRaw, duration, openPorts, results.length);
      }

      broadcast({
        type: "done",
        duration: state.duration,
        stopped,
        open_count: openPorts.length,
        total: results.length,
      });
    },
  });

  state.scanner = scanner;
  scans.set(scanId, state);

  try {
    scanner.start();
  } catch (exc) {
    logError("scanner.start", exc);
    scans.delete(scanId);
    return res.status(500).json({ error: `Could not start scan: ${String(exc)}` });
  }

  return res.json({ scan_id: scanId, resolved_ip: resolvedIp });
});

app.get("/api/scan/:scan_id/stream", (req: Request, res: Response) => {
  const scanId = Array.isArray(req.params.scan_id) ? req.params.scan_id[0] : req.params.scan_id;
  const state = scans.get(scanId);

  if (!state) {
    return res.status(404).json({ error: "Unknown scan_id" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write("retry: 2000\n\n");

  // Send historical events that occurred prior to connecting
  for (const ev of state.eventHistory) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  // If already finished, end response
  if (state.status !== "running") {
    return res.end();
  }

  const listener = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === "done") {
      cleanup();
      res.end();
    }
  };

  state.listeners.push(listener);

  const keepAliveTimer = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15000);

  const cleanup = () => {
    clearInterval(keepAliveTimer);
    const idx = state.listeners.indexOf(listener);
    if (idx !== -1) {
      state.listeners.splice(idx, 1);
    }
  };

  req.on("close", cleanup);
});

app.post("/api/scan/:scan_id/stop", (req: Request, res: Response) => {
  const scanId = Array.isArray(req.params.scan_id) ? req.params.scan_id[0] : req.params.scan_id;
  const state = scans.get(scanId);

  if (!state) {
    return res.status(404).json({ error: "Unknown scan_id" });
  }

  state.scanner.stop();
  return res.json({ ok: true });
});

app.get("/api/scan/:scan_id/export", (req: Request, res: Response) => {
  const scanId = Array.isArray(req.params.scan_id) ? req.params.scan_id[0] : req.params.scan_id;
  const state = scans.get(scanId);

  if (!state) {
    return res.status(404).json({ error: "Unknown scan_id" });
  }

  const fmt = String(req.query.fmt || "csv").toLowerCase();
  const results = state.results;

  if (!results || results.length === 0) {
    return res.status(400).json({ error: "No results to export yet." });
  }

  try {
    const exportResult = exportResults(EXPORT_DIR, state.target, results, state.duration, fmt);
    res.setHeader("Content-Type", exportResult.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${exportResult.filename}"`);
    return res.send(exportResult.content);
  } catch (exc) {
    logError("api_scan_export", exc);
    return res.status(400).json({ error: String(exc) });
  }
});

// Global Error Handler to catch any unhandled request errors gracefully
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error", details: err?.message || String(err) });
});

export const handler = app;
export default app;
