import dns from "node:dns/promises";
import net from "node:net";

export interface TargetResult {
  isValid: boolean;
  message: string;
  resolvedIp?: string;
}

export async function validateTarget(target: string): Promise<TargetResult> {
  const cleanTarget = (target || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  if (!cleanTarget) {
    return { isValid: false, message: "Target cannot be empty." };
  }

  // Check if it's already an IP address
  if (net.isIP(cleanTarget)) {
    return {
      isValid: true,
      message: "Valid IP address.",
      resolvedIp: cleanTarget,
    };
  }

  // Attempt hostname resolution via DNS (prefer IPv4 for outbound socket reliability)
  try {
    try {
      const ipv4 = await dns.lookup(cleanTarget, { family: 4 });
      return {
        isValid: true,
        message: `Resolved '${cleanTarget}' to ${ipv4.address}.`,
        resolvedIp: ipv4.address,
      };
    } catch {
      const fallback = await dns.lookup(cleanTarget);
      return {
        isValid: true,
        message: `Resolved '${cleanTarget}' to ${fallback.address}.`,
        resolvedIp: fallback.address,
      };
    }
  } catch (err: any) {
    return {
      isValid: false,
      message: `Could not resolve hostname '${cleanTarget}'. Check spelling and your network connection.`,
    };
  }
}

export function parsePorts(input: string | number | number[]): number[] {
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map(Number).filter((p) => p >= 1 && p <= 65535))).sort((a, b) => a - b);
  }
  if (typeof input === "number") {
    return input >= 1 && input <= 65535 ? [input] : [];
  }
  const str = String(input || "").trim();
  if (!str) return [];

  const result = new Set<number>();
  const parts = str.split(/[,\s]+/);

  for (const part of parts) {
    if (!part) continue;
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const s = parseInt(startStr, 10);
      const e = parseInt(endStr, 10);
      if (!isNaN(s) && !isNaN(e) && s >= 1 && e <= 65535 && s <= e) {
        for (let i = s; i <= e; i++) {
          result.add(i);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= 65535) {
        result.add(p);
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}

export function validatePortRange(start: unknown, end: unknown): [boolean, string] {
  const startNum = Number(start);
  const endNum = Number(end);

  if (!Number.isInteger(startNum) || !Number.isInteger(endNum)) {
    return [false, "Start and end ports must be whole numbers."];
  }

  if (startNum < 1 || startNum > 65535 || endNum < 1 || endNum > 65535) {
    return [false, "Ports must be between 1 and 65535."];
  }

  if (startNum > endNum) {
    return [false, "Start port must be less than or equal to end port."];
  }

  return [true, "Valid port range."];
}

export function validateTimeout(value: unknown): [boolean, string] {
  const v = Number(value);
  if (Number.isNaN(v)) {
    return [false, "Timeout must be a number."];
  }
  if (v < 0.05 || v > 30) {
    return [false, "Timeout should be between 0.05 and 30 seconds."];
  }
  return [true, "Valid timeout."];
}

export function validateThreads(value: unknown): [boolean, string] {
  const v = Number(value);
  if (!Number.isInteger(v)) {
    return [false, "Thread count must be a whole number."];
  }
  if (v < 1 || v > 500) {
    return [false, "Thread count should be between 1 and 500."];
  }
  return [true, "Valid thread count."];
}
