import fs from "node:fs";
import path from "node:path";

let styleCache: string | null = null;
let appJsCache: string | null = null;

export function getStyleCss(): string {
  if (styleCache) return styleCache;
  try {
    const p = path.join(process.cwd(), "static", "style.css");
    if (fs.existsSync(p)) {
      styleCache = fs.readFileSync(p, "utf-8");
      return styleCache;
    }
  } catch {
    // ignore
  }
  return "";
}

export function getAppJs(): string {
  if (appJsCache) return appJsCache;
  try {
    const p = path.join(process.cwd(), "static", "app.js");
    if (fs.existsSync(p)) {
      appJsCache = fs.readFileSync(p, "utf-8");
      return appJsCache;
    }
  } catch {
    // ignore
  }
  return "";
}
