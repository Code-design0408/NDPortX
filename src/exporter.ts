import fs from "node:fs";
import path from "node:path";
import { ScanResult } from "./scanner.js";
import { ensureDir, nowStampForFilename } from "./utils.js";

export interface ScanSummary {
  target: string;
  scan_date: string;
  duration_seconds: number;
  total_ports: number;
  open_count: number;
  closed_count: number;
  filtered_count: number;
}

export function buildSummary(target: string, results: ScanResult[], duration: number): ScanSummary {
  const open = results.filter((r) => r.status === "open");
  const closed = results.filter((r) => r.status === "closed");
  const filtered = results.filter((r) => r.status !== "open" && r.status !== "closed");
  return {
    target,
    scan_date: results[0]?.scanned_at || "",
    duration_seconds: Math.round(duration * 100) / 100,
    total_ports: results.length,
    open_count: open.length,
    closed_count: closed.length,
    filtered_count: filtered.length,
  };
}

export function buildExportFilename(target: string, fmt: string): string {
  const safeTarget = target.replace(/[:/\\]/g, "_");
  return `ndportx_${safeTarget}_${nowStampForFilename()}.${fmt}`;
}

export function exportTxt(target: string, results: ScanResult[], duration: number): string {
  const summary = buildSummary(target, results, duration);
  const lines = [
    "NDPortX - Scan Report",
    "=".repeat(40),
    `Target:        ${summary.target}`,
    `Scan date:     ${summary.scan_date}`,
    `Duration:      ${summary.duration_seconds}s`,
    `Total ports:   ${summary.total_ports}`,
    `Open ports:    ${summary.open_count}`,
    `Closed ports:  ${summary.closed_count}`,
    `Filtered:      ${summary.filtered_count}`,
    "-".repeat(40),
    "PORT     STATUS     SERVICE          BANNER",
  ];
  for (const r of results) {
    const banner = (r.banner || "").slice(0, 40);
    const p = String(r.port).padEnd(8);
    const st = r.status.padEnd(10);
    const sv = r.service.padEnd(16);
    lines.push(`${p} ${st} ${sv} ${banner}`);
  }
  return lines.join("\n");
}

export function exportCsv(target: string, results: ScanResult[], duration: number): string {
  const summary = buildSummary(target, results, duration);
  const lines = [
    `# Target,${summary.target}`,
    `# Scan date,${summary.scan_date}`,
    `# Duration (s),${summary.duration_seconds}`,
    `# Open,${summary.open_count}`,
    `# Closed,${summary.closed_count}`,
    `# Filtered,${summary.filtered_count}`,
    "",
    "Port,Status,Service,Banner,Response Time (ms)",
  ];
  for (const r of results) {
    const banner = (r.banner || "").replace(/"/g, '""');
    lines.push(`${r.port},${r.status},${r.service},"${banner}",${r.response_ms}`);
  }
  return lines.join("\n");
}

export function exportJson(target: string, results: ScanResult[], duration: number): string {
  const summary = buildSummary(target, results, duration);
  return JSON.stringify(
    {
      summary,
      results,
    },
    null,
    2
  );
}

export function exportResults(
  exportFolder: string,
  target: string,
  results: ScanResult[],
  duration: number,
  fmt: string
): { filePath: string; filename: string; content: string; mimeType: string } {
  const cleanFmt = fmt.toLowerCase().replace(/^\./, "");
  ensureDir(exportFolder);
  const filename = buildExportFilename(target, cleanFmt);
  const filePath = path.join(exportFolder, filename);

  let content = "";
  let mimeType = "text/plain";

  if (cleanFmt === "csv") {
    content = exportCsv(target, results, duration);
    mimeType = "text/csv";
  } else if (cleanFmt === "json") {
    content = exportJson(target, results, duration);
    mimeType = "application/json";
  } else if (cleanFmt === "txt") {
    content = exportTxt(target, results, duration);
    mimeType = "text/plain";
  } else {
    throw new Error(`Unsupported export format: ${fmt}`);
  }

  fs.writeFileSync(filePath, content, "utf-8");
  return { filePath, filename, content, mimeType };
}
