import fs from "node:fs";
import path from "node:path";

export function formatDuration(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatSpeed(portsScanned: number, elapsed: number): string {
  if (elapsed <= 0) return "0.0 ports/s";
  return `${(portsScanned / elapsed).toFixed(1)} ports/s`;
}

export function nowStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function nowStampForFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function ensureDir(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

export function etaSeconds(done: number, total: number, elapsed: number): number {
  if (done <= 0 || elapsed <= 0) return 0;
  const rate = done / elapsed;
  const remaining = total - done;
  return rate > 0 ? remaining / rate : 0;
}

export class Stopwatch {
  private _start: number = 0;
  private _running: boolean = false;
  private _elapsed: number = 0;

  start(): void {
    this._start = performance.now();
    this._running = true;
  }

  stop(): void {
    if (this._running) {
      this._elapsed = (performance.now() - this._start) / 1000;
      this._running = false;
    }
  }

  elapsed(): number {
    if (!this._running) return this._elapsed;
    return (performance.now() - this._start) / 1000;
  }
}
