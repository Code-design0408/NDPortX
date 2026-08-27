import net from "node:net";
import { getService } from "./services.js";
import { Stopwatch, nowStr } from "./utils.js";

export interface ScanResult {
  port: number;
  status: "open" | "closed" | "filtered";
  service: string;
  banner: string | null;
  response_ms: number;
  scanned_at: string;
}

export type ProgressCallback = (done: number, total: number, elapsed: number) => void;
export type ResultCallback = (result: ScanResult) => void;
export type DoneCallback = (results: ScanResult[], duration: number, stopped: boolean) => void;

export class PortScanner {
  public targetIp: string;
  public ports: number[];
  public timeout: number;
  public maxThreads: number;
  public grabBanner: boolean;

  public onProgress?: ProgressCallback;
  public onResult?: ResultCallback;
  public onDone?: DoneCallback;

  private _stopped: boolean = false;
  private _completed: number = 0;
  private _results: ScanResult[] = [];
  private _stopwatch: Stopwatch = new Stopwatch();

  constructor(options: {
    targetIp: string;
    ports?: number[];
    startPort?: number;
    endPort?: number;
    timeout?: number;
    maxThreads?: number;
    grabBanner?: boolean;
    onProgress?: ProgressCallback;
    onResult?: ResultCallback;
    onDone?: DoneCallback;
  }) {
    this.targetIp = options.targetIp;

    if (options.ports && options.ports.length > 0) {
      this.ports = Array.from(new Set(options.ports)).sort((a, b) => a - b);
    } else {
      const s = options.startPort ?? 1;
      const e = options.endPort ?? 1024;
      const list: number[] = [];
      for (let p = s; p <= e; p++) {
        list.push(p);
      }
      this.ports = list;
    }

    this.timeout = options.timeout ?? 0.5;
    this.maxThreads = options.maxThreads ?? 100;
    this.grabBanner = options.grabBanner ?? true;

    this.onProgress = options.onProgress;
    this.onResult = options.onResult;
    this.onDone = options.onDone;
  }

  get totalPorts(): number {
    return this.ports.length;
  }

  public start(): void {
    this._stopped = false;
    this._completed = 0;
    this._results = [];
    this._stopwatch.start();
    this.runPool().catch((err) => {
      console.error("Error in port scanner worker pool:", err);
    });
  }

  public stop(): void {
    this._stopped = true;
  }

  public isStopped(): boolean {
    return this._stopped;
  }

  private scanPort(port: number): Promise<ScanResult> {
    const startTime = performance.now();
    const service = getService(port);
    const timeoutMs = Math.max(50, Math.round(this.timeout * 1000));

    return new Promise<ScanResult>((resolve) => {
      let isSettled = false;
      const socket = new net.Socket();
      let timer: NodeJS.Timeout | null = null;
      let bannerTimer: NodeJS.Timeout | null = null;
      let banner: string | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (bannerTimer) {
          clearTimeout(bannerTimer);
          bannerTimer = null;
        }
        socket.removeAllListeners();
        socket.destroy();
      };

      const finish = (status: "open" | "closed" | "filtered") => {
        if (isSettled) return;
        isSettled = true;
        const elapsedMs = performance.now() - startTime;
        cleanup();
        resolve({
          port,
          status,
          service,
          banner,
          response_ms: Math.round(elapsedMs * 10) / 10,
          scanned_at: nowStr(),
        });
      };

      // Connect timeout timer
      timer = setTimeout(() => {
        finish("filtered");
      }, timeoutMs);

      socket.setTimeout(timeoutMs);

      // Attempt TCP 3-way handshake
      socket.connect(
        {
          port,
          host: this.targetIp,
        },
        () => {
          // Connected successfully => Port is definitely OPEN!
          // Crucial: Clear the connect timeout immediately so it never falsely marks as filtered
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }

          if (!this.grabBanner) {
            finish("open");
            return;
          }

          // Banner grab window
          bannerTimer = setTimeout(() => {
            finish("open");
          }, 150);

          socket.on("data", (chunk: Buffer) => {
            const raw = chunk
              .toString("utf-8")
              .replace(/[\r\n\x00-\x1F\x7F]+/g, " ")
              .trim();
            if (raw) {
              banner = raw.slice(0, 100);
            }
            finish("open");
          });

          socket.on("error", () => {
            finish("open");
          });

          socket.on("close", () => {
            finish("open");
          });

          // Send lightweight probe based on common services
          try {
            if (port === 80 || port === 8080 || port === 3000 || port === 5000 || port === 8000) {
              socket.write(`HEAD / HTTP/1.0\r\nHost: ${this.targetIp}\r\n\r\n`);
            } else if (port === 443 || port === 8443) {
              // SSL/TLS will respond or disconnect; already open
            } else {
              socket.write("\r\n");
            }
          } catch {
            // ignore probe write errors
          }
        }
      );

      socket.on("timeout", () => {
        finish("filtered");
      });

      socket.on("error", (err: any) => {
        const code = err?.code || "";
        if (code === "ECONNREFUSED") {
          // RST received => Host is alive, port is closed
          finish("closed");
        } else if (code === "ECONNRESET" || code === "EPIPE") {
          // Connection accepted then reset => open
          finish("open");
        } else if (
          code === "ETIMEDOUT" ||
          code === "EHOSTUNREACH" ||
          code === "ENETUNREACH" ||
          code === "EHOSTDOWN" ||
          code === "ENETDOWN" ||
          code === "ENOTFOUND"
        ) {
          // Firewall dropped packets or network unreachable
          finish("filtered");
        } else {
          // General socket failure
          finish("closed");
        }
      });
    });
  }

  private async runPool(): Promise<void> {
    const ports = this.ports;
    let currentIndex = 0;
    const workerCount = Math.min(this.maxThreads, ports.length);

    const worker = async () => {
      while (currentIndex < ports.length && !this._stopped) {
        const portIndex = currentIndex++;
        const port = ports[portIndex];
        const result = await this.scanPort(port);

        this._completed++;
        this._results.push(result);

        if (this.onResult) {
          this.onResult(result);
        }
        if (this.onProgress) {
          this.onProgress(this._completed, this.totalPorts, this._stopwatch.elapsed());
        }
      }
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < workerCount; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    const elapsed = this._stopwatch.elapsed() || 0.0;
    this._stopwatch.stop();

    // Stable sort by port
    this._results.sort((a, b) => a.port - b.port);

    if (this.onDone) {
      this.onDone(this._results, elapsed, this._stopped);
    }
  }
}
