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
  public startPort: number;
  public endPort: number;
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
    startPort: number;
    endPort: number;
    timeout?: number;
    maxThreads?: number;
    grabBanner?: boolean;
    onProgress?: ProgressCallback;
    onResult?: ResultCallback;
    onDone?: DoneCallback;
  }) {
    this.targetIp = options.targetIp;
    this.startPort = options.startPort;
    this.endPort = options.endPort;
    this.timeout = options.timeout ?? 0.5;
    this.maxThreads = options.maxThreads ?? 100;
    this.grabBanner = options.grabBanner ?? true;

    this.onProgress = options.onProgress;
    this.onResult = options.onResult;
    this.onDone = options.onDone;
  }

  get totalPorts(): number {
    return this.endPort - this.startPort + 1;
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
      let banner: string | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
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
          response_ms: Math.round(elapsedMs * 100) / 100,
          scanned_at: nowStr(),
        });
      };

      timer = setTimeout(() => {
        finish("filtered");
      }, timeoutMs);

      socket.setTimeout(timeoutMs);

      socket.connect(port, this.targetIp, () => {
        if (!this.grabBanner) {
          finish("open");
          return;
        }

        // Set quick banner grab timeout
        socket.setTimeout(400);

        socket.on("data", (chunk: Buffer) => {
          banner = chunk
            .toString("utf-8")
            .replace(/[\r\n\x00-\x1F\x7F]+/g, " ")
            .trim()
            .slice(0, 120);
          finish("open");
        });

        socket.on("timeout", () => {
          finish("open");
        });
      });

      socket.on("timeout", () => {
        finish("filtered");
      });

      socket.on("error", (err: any) => {
        if (err.code === "ECONNREFUSED") {
          finish("closed");
        } else if (
          err.code === "ETIMEDOUT" ||
          err.code === "EHOSTUNREACH" ||
          err.code === "ENETUNREACH" ||
          err.code === "ENOTFOUND"
        ) {
          finish("filtered");
        } else {
          finish("closed");
        }
      });
    });
  }

  private async runPool(): Promise<void> {
    const ports: number[] = [];
    for (let p = this.startPort; p <= this.endPort; p++) {
      ports.push(p);
    }

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

    // Sort by port for stable order
    this._results.sort((a, b) => a.port - b.port);

    if (this.onDone) {
      this.onDone(this._results, elapsed, this._stopped);
    }
  }
}
