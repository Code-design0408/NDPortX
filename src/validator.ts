import dns from "node:dns/promises";
import net from "node:net";

export interface TargetResult {
  isValid: boolean;
  message: string;
  resolvedIp?: string;
}

export async function validateTarget(target: string): Promise<TargetResult> {
  const cleanTarget = (target || "").trim();
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

  // Attempt hostname resolution via DNS
  try {
    const lookupResult = await dns.lookup(cleanTarget);
    return {
      isValid: true,
      message: `Resolved '${cleanTarget}' to ${lookupResult.address}.`,
      resolvedIp: lookupResult.address,
    };
  } catch (err: any) {
    return {
      isValid: false,
      message: `Could not resolve hostname '${cleanTarget}'. Check spelling and your network connection.`,
    };
  }
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
