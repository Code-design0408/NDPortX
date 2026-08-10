"""
validator.py
------------
Input validation for target hosts, port ranges, timeouts and thread
counts. Every function returns a (is_valid, message) tuple (plus a
resolved value where useful) so the GUI can surface a clear, specific
error to the user instead of a raw exception.
"""

from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass


@dataclass
class TargetResult:
    is_valid: bool
    message: str
    resolved_ip: str | None = None


def validate_target(target: str) -> TargetResult:
    """
    Validate a scan target, which may be an IPv4 address or a hostname.
    Hostnames are resolved via DNS so the scanner works with an IP from
    here on. Does NOT permit empty input or obviously malformed values.
    """
    target = (target or "").strip()
    if not target:
        return TargetResult(False, "Target cannot be empty.")

    # Try as a literal IP address first.
    try:
        ip = ipaddress.ip_address(target)
        return TargetResult(True, "Valid IP address.", str(ip))
    except ValueError:
        pass

    # Fall back to hostname resolution.
    try:
        resolved = socket.gethostbyname(target)
        return TargetResult(True, f"Resolved '{target}' to {resolved}.", resolved)
    except socket.gaierror:
        return TargetResult(
            False,
            f"Could not resolve hostname '{target}'. Check spelling and "
            f"your network connection.",
        )


def validate_port_range(start: str | int, end: str | int) -> tuple[bool, str]:
    """Validate that start/end ports are integers within 1-65535 and ordered."""
    try:
        start_i = int(start)
        end_i = int(end)
    except (TypeError, ValueError):
        return False, "Start and end ports must be whole numbers."

    if not (1 <= start_i <= 65535) or not (1 <= end_i <= 65535):
        return False, "Ports must be between 1 and 65535."

    if start_i > end_i:
        return False, "Start port must be less than or equal to end port."

    return True, "Valid port range."


def validate_timeout(value: str | float) -> tuple[bool, str]:
    """Validate the per-connection timeout in seconds."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return False, "Timeout must be a number."
    if not (0.05 <= v <= 30):
        return False, "Timeout should be between 0.05 and 30 seconds."
    return True, "Valid timeout."


def validate_threads(value: str | int) -> tuple[bool, str]:
    """Validate the worker thread count."""
    try:
        v = int(value)
    except (TypeError, ValueError):
        return False, "Thread count must be a whole number."
    if not (1 <= v <= 500):
        return False, "Thread count should be between 1 and 500."
    return True, "Valid thread count."
