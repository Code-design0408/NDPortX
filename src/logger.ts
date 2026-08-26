import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureDir, nowStr } from "./utils.js";

const LOG_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "ndportx-logs")
  : path.join(process.cwd(), "logs");

function writeLog(level: string, message: string): void {
  const line = `${nowStr()} | ${level.padEnd(7)} | ${message}\n`;
  console.log(line.trim());
  try {
    ensureDir(LOG_DIR);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const logFilename = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.log`;
    const logFile = path.join(LOG_DIR, logFilename);
    fs.appendFileSync(logFile, line, "utf-8");
  } catch (e) {
    // Non-fatal if logging to disk fails
  }
}

export function logScanStart(target: string, startPort: number, endPort: number): void {
  writeLog("INFO", `SCAN START target=${target} ports=${startPort}-${endPort}`);
}

export function logScanComplete(
  target: string,
  duration: number,
  openPorts: number[],
  totalPorts: number
): void {
  writeLog(
    "INFO",
    `SCAN COMPLETE target=${target} duration=${duration.toFixed(2)}s total_ports=${totalPorts} open=${openPorts.length} open_ports=[${openPorts.join(", ")}]`
  );
}

export function logScanStopped(target: string, portsCompleted: number, totalPorts: number): void {
  writeLog("WARNING", `SCAN STOPPED target=${target} progress=${portsCompleted}/${totalPorts}`);
}

export function logError(context: string, error: unknown): void {
  writeLog("ERROR", `ERROR in ${context}: ${String(error)}`);
}
