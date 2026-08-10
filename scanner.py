"""
scanner.py
----------
The scanning engine. Contains no GUI code so it can be unit tested or
reused independently of CustomTkinter. Runs a TCP Connect scan across
a pool of worker threads and reports progress/results via callbacks,
so the GUI thread is never blocked.

Only intended for use against hosts you own or are explicitly
authorized to test.
"""

from __future__ import annotations

import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor, Future
from dataclasses import dataclass, field
from typing import Callable, Optional

from services import get_service
from utils import Stopwatch, now_str


@dataclass
class ScanResult:
    port: int
    status: str  # "open" | "closed" | "filtered"
    service: str
    banner: Optional[str] = None
    response_ms: float = 0.0
    scanned_at: str = field(default_factory=now_str)


# Callback signatures used to keep the GUI decoupled from the engine.
ProgressCallback = Callable[[int, int, float], None]  # done, total, elapsed
ResultCallback = Callable[[ScanResult], None]
DoneCallback = Callable[[list[ScanResult], float, bool], None]  # results, duration, was_stopped


class PortScanner:
    """
    Threaded TCP Connect port scanner.

    Usage:
        scanner = PortScanner(target, start_port, end_port,
                               timeout=0.5, max_threads=100,
                               on_progress=..., on_result=..., on_done=...)
        scanner.start()
        ...
        scanner.stop()   # optional, graceful cancellation
    """

    def __init__(
        self,
        target_ip: str,
        start_port: int,
        end_port: int,
        timeout: float = 0.5,
        max_threads: int = 100,
        grab_banner: bool = True,
        on_progress: Optional[ProgressCallback] = None,
        on_result: Optional[ResultCallback] = None,
        on_done: Optional[DoneCallback] = None,
    ) -> None:
        self.target_ip = target_ip
        self.start_port = start_port
        self.end_port = end_port
        self.timeout = timeout
        self.max_threads = max_threads
        self.grab_banner = grab_banner

        self.on_progress = on_progress
        self.on_result = on_result
        self.on_done = on_done

        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._completed = 0
        self._results: list[ScanResult] = []
        self._stopwatch = Stopwatch()
        self._executor: Optional[ThreadPoolExecutor] = None
        self._runner_thread: Optional[threading.Thread] = None

    @property
    def total_ports(self) -> int:
        return self.end_port - self.start_port + 1

    def start(self) -> None:
        """Kick off the scan on a background thread (non-blocking)."""
        self._stop_event.clear()
        self._completed = 0
        self._results = []
        self._stopwatch.start()
        self._runner_thread = threading.Thread(target=self._run, daemon=True)
        self._runner_thread.start()

    def stop(self) -> None:
        """Request graceful cancellation. In-flight sockets finish, no new ones start."""
        self._stop_event.set()

    def is_stopped(self) -> bool:
        return self._stop_event.is_set()

    # -- internals ----------------------------------------------------

    def _scan_port(self, port: int) -> ScanResult:
        start = time.perf_counter()
        service = get_service(port)
        banner = None
        status = "closed"

        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(self.timeout)
                result_code = sock.connect_ex((self.target_ip, port))
                if result_code == 0:
                    status = "open"
                    if self.grab_banner:
                        banner = self._try_grab_banner(sock)
                else:
                    status = "closed"
        except socket.timeout:
            status = "filtered"
        except OSError:
            status = "filtered"

        elapsed_ms = (time.perf_counter() - start) * 1000
        return ScanResult(
            port=port,
            status=status,
            service=service,
            banner=banner,
            response_ms=round(elapsed_ms, 2),
        )

    @staticmethod
    def _try_grab_banner(sock: socket.socket) -> Optional[str]:
        """Best-effort banner grab; never raises, never blocks for long."""
        try:
            sock.settimeout(0.4)
            data = sock.recv(128)
            if data:
                return data.decode(errors="replace").strip()[:120]
        except (socket.timeout, OSError):
            return None
        return None

    def _run(self) -> None:
        ports = range(self.start_port, self.end_port + 1)
        was_stopped = False

        with ThreadPoolExecutor(max_workers=self.max_threads) as executor:
            self._executor = executor
            futures: dict[Future, int] = {}
            for port in ports:
                if self._stop_event.is_set():
                    was_stopped = True
                    break
                futures[executor.submit(self._scan_port, port)] = port

            for future in futures:
                if self._stop_event.is_set():
                    was_stopped = True
                # Still collect results already in-flight/completed.
                try:
                    result = future.result()
                except Exception:
                    continue

                with self._lock:
                    self._completed += 1
                    self._results.append(result)
                    done = self._completed

                if self.on_result:
                    self.on_result(result)
                if self.on_progress:
                    self.on_progress(done, self.total_ports, self._stopwatch.elapsed())

        elapsed = self._stopwatch.elapsed() or 0.0
        self._stopwatch.stop()
        # Sort results by port for a stable, readable output order.
        self._results.sort(key=lambda r: r.port)
        if self.on_done:
            self.on_done(self._results, elapsed, was_stopped)
