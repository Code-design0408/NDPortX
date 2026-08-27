// app.js -- NDPortX high-speed TCP scanner client

const el = (id) => document.getElementById(id);

// ---- Ethics modal ----------------------------------------------------
el("agreeBtn")?.addEventListener("click", () => {
  el("ethicsModal")?.classList.add("hidden");
});

// ---- Quick Target Chips ----------------------------------------------
document.querySelectorAll(".target-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-target");
    if (target) {
      el("targetInput").value = target;
      el("targetStatus").textContent = "";
    }
  });
});

// ---- State -----------------------------------------------------------
let currentScanId = null;
let currentSource = null;
let allResults = [];
let scanTarget = "";
let currentFilter = "all";
let renderTimer = null;
let PRESETS_CACHE = {};

// ---- Presets ---------------------------------------------------------
fetch("/api/presets")
  .then((r) => r.json())
  .then((data) => {
    PRESETS_CACHE = data;
    updatePresetUI();
  })
  .catch(() => {});

function updatePresetUI() {
  const presetName = el("presetSelect").value;
  const customSection = el("customPortSection");
  const countInfo = el("portCountInfo");

  if (presetName === "Custom") {
    customSection.classList.remove("hidden");
    const customVal = el("customPortsInput").value.trim();
    if (customVal) {
      countInfo.textContent = "Custom port list defined.";
    } else {
      const s = parseInt(el("startPort").value, 10) || 1;
      const e = parseInt(el("endPort").value, 10) || 1024;
      const count = Math.max(0, e - s + 1);
      countInfo.textContent = `Selected: ${count.toLocaleString()} ports (${s} - ${e})`;
    }
  } else {
    customSection.classList.add("hidden");
    const preset = PRESETS_CACHE[presetName];
    if (preset) {
      countInfo.textContent = `Selected: ${preset.count.toLocaleString()} ports`;
    }
  }
}

el("presetSelect").addEventListener("change", updatePresetUI);
el("startPort").addEventListener("input", updatePresetUI);
el("endPort").addEventListener("input", updatePresetUI);
el("customPortsInput").addEventListener("input", updatePresetUI);

// ---- Helpers ---------------------------------------------------------
function formatDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSpeed(count, duration) {
  if (!duration || duration <= 0) return "0.0 p/s";
  return `${(count / duration).toFixed(1)} p/s`;
}

function setStatus(text, cls) {
  const pill = el("statusPill");
  if (!pill) return;
  pill.textContent = text;
  pill.className = "status-pill " + cls;
}

// ---- Start scan ------------------------------------------------------
el("startBtn").addEventListener("click", async () => {
  const target = el("targetInput").value.trim();
  const presetName = el("presetSelect").value;
  const timeout = parseFloat(el("timeoutInput").value) || 0.5;
  const threads = parseInt(el("threadsInput").value, 10) || 100;

  el("targetStatus").textContent = "";
  el("targetStatus").style.color = "";

  if (!target) {
    el("targetStatus").textContent = "Please enter a target host or IP address.";
    el("targetStatus").style.color = "var(--error)";
    return;
  }

  const payload = {
    target,
    timeout,
    threads,
  };

  if (presetName === "Custom") {
    const customPorts = el("customPortsInput").value.trim();
    if (customPorts) {
      payload.ports = customPorts;
    } else {
      payload.start_port = parseInt(el("startPort").value, 10) || 1;
      payload.end_port = parseInt(el("endPort").value, 10) || 1024;
    }
  } else {
    payload.preset = presetName;
  }

  el("startBtn").disabled = true;
  setStatus("● RESOLVING...", "running");

  try {
    const resp = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();

    if (!resp.ok) {
      el("targetStatus").textContent = data.error || "Could not start scan.";
      el("targetStatus").style.color = "var(--error)";
      el("startBtn").disabled = false;
      setStatus("● IDLE", "idle");
      return;
    }

    scanTarget = target;
    clearResults(false);
    el("statTarget").textContent = target;
    el("statTotal").textContent = String(data.total_ports || 0);
    el("targetStatus").textContent = `Resolved to ${data.resolved_ip} (${data.total_ports} ports scheduled)`;
    el("targetStatus").style.color = "var(--primary)";

    currentScanId = data.scan_id;
    el("startBtn").disabled = true;
    el("stopBtn").disabled = false;
    setStatus("● SCANNING", "running");

    openStream(currentScanId);
  } catch (err) {
    el("targetStatus").textContent = "Connection error. Ensure the server is reachable.";
    el("targetStatus").style.color = "var(--error)";
    el("startBtn").disabled = false;
    setStatus("● IDLE", "idle");
  }
});

function openStream(scanId) {
  if (currentSource) currentSource.close();
  const source = new EventSource(`/api/scan/${scanId}/stream`);
  currentSource = source;

  source.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      if (event.type === "progress") handleProgress(event);
      else if (event.type === "result") handleResult(event.result);
      else if (event.type === "done") handleDone(event);
    } catch {
      // ignore JSON parse error
    }
  };

  source.onerror = () => {
    // If connection drops, EventSource will automatically retry or finish
  };
}

function handleProgress(event) {
  const pct = event.total ? Math.min(100, (event.done / event.total) * 100) : 0;
  el("progressBar").style.width = pct + "%";
  el("pctVal").textContent = Math.round(pct) + "%";
  el("elapsedVal").textContent = formatDuration(event.elapsed);
  el("remainingVal").textContent = String(Math.max(0, event.total - event.done));

  const rate = event.done / (event.elapsed || 1);
  const etaSec = rate > 0 ? (event.total - event.done) / rate : 0;
  el("etaVal").textContent = formatDuration(etaSec);
  el("statSpeed").textContent = formatSpeed(event.done, event.elapsed);

  if (allResults.length) {
    el("curPortVal").textContent = allResults[allResults.length - 1].port;
  }
}

function handleResult(result) {
  allResults.push(result);
  scheduleTableRender();
  updateCounts();
}

function updateCounts() {
  const open = allResults.filter((r) => r.status === "open").length;
  const closed = allResults.filter((r) => r.status === "closed").length;
  const filtered = allResults.filter((r) => r.status === "filtered").length;
  const total = allResults.length;

  el("statOpen").textContent = open;
  el("statClosed").textContent = closed;
  el("statFiltered").textContent = filtered;
  el("statTotal").textContent = total;

  el("countAllTab").textContent = total;
  el("countOpenTab").textContent = open;
  el("countClosedTab").textContent = closed;
  el("countFilteredTab").textContent = filtered;
}

function handleDone(event) {
  el("startBtn").disabled = false;
  el("stopBtn").disabled = true;
  el("statDuration").textContent = formatDuration(event.duration);
  el("statSpeed").textContent = formatSpeed(event.total, event.duration);
  el("progressBar").style.width = "100%";
  el("pctVal").textContent = "100%";
  el("remainingVal").textContent = "0";
  el("etaVal").textContent = "0:00";

  updateCounts();
  renderTableImmediate();

  if (event.stopped) {
    setStatus("● STOPPED", "stopped");
  } else {
    setStatus("● COMPLETE", "complete");
  }
  if (currentSource) currentSource.close();
}

// ---- Stop -------------------------------------------------------------
el("stopBtn").addEventListener("click", async () => {
  if (!currentScanId) return;
  setStatus("● STOPPING", "stopping");
  await fetch(`/api/scan/${currentScanId}/stop`, { method: "POST" });
});

// ---- Clear ------------------------------------------------------------
function clearResults(resetTarget = true) {
  allResults = [];
  el("resultsBody").innerHTML = `
    <tr class="empty-row">
      <td colspan="5" class="empty-msg">No scan active. Enter a target and click <strong>▶ Start Port Scan</strong> to begin.</td>
    </tr>`;
  el("progressBar").style.width = "0%";
  el("pctVal").textContent = "0%";
  el("curPortVal").textContent = "-";
  el("elapsedVal").textContent = "0:00";
  el("remainingVal").textContent = "0";
  el("etaVal").textContent = "0:00";
  el("statTotal").textContent = "0";
  el("statOpen").textContent = "0";
  el("statClosed").textContent = "0";
  el("statFiltered").textContent = "0";
  el("statDuration").textContent = "0:00";
  el("statSpeed").textContent = "0.0 p/s";
  el("countAllTab").textContent = "0";
  el("countOpenTab").textContent = "0";
  el("countClosedTab").textContent = "0";
  el("countFilteredTab").textContent = "0";

  if (resetTarget) {
    el("statTarget").textContent = "-";
    el("targetStatus").textContent = "";
  }
  setStatus("● IDLE", "idle");
}

el("clearBtn").addEventListener("click", () => {
  if (currentSource) currentSource.close();
  clearResults(true);
});

// ---- Filter tabs ------------------------------------------------------
document.querySelectorAll(".filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.getAttribute("data-filter") || "all";
    renderTableImmediate();
  });
});

// Mini card clicks for quick filter
el("filterCardOpen")?.addEventListener("click", () => {
  el("tabOpen")?.click();
});
el("filterCardClosed")?.addEventListener("click", () => {
  el("tabClosed")?.click();
});
el("filterCardFiltered")?.addEventListener("click", () => {
  el("tabFiltered")?.click();
});

// ---- Search & Sort ----------------------------------------------------
el("searchInput").addEventListener("input", scheduleTableRender);
el("sortSelect").addEventListener("change", renderTableImmediate);

function scheduleTableRender() {
  if (renderTimer) return;
  renderTimer = requestAnimationFrame(() => {
    renderTableImmediate();
    renderTimer = null;
  });
}

function renderTableImmediate() {
  const query = el("searchInput").value.trim().toLowerCase();
  const sortMode = el("sortSelect").value;

  let rows = [...allResults];

  // Apply State Tab Filter
  if (currentFilter !== "all") {
    rows = rows.filter((r) => r.status === currentFilter);
  }

  // Apply Search
  if (query) {
    rows = rows.filter(
      (r) =>
        String(r.port).includes(query) ||
        r.service.toLowerCase().includes(query) ||
        (r.banner && r.banner.toLowerCase().includes(query))
    );
  }

  // Apply Sorting
  if (sortMode === "port") {
    rows.sort((a, b) => a.port - b.port);
  } else if (sortMode === "port-desc") {
    rows.sort((a, b) => b.port - a.port);
  } else if (sortMode === "status") {
    const priority = { open: 1, filtered: 2, closed: 3 };
    rows.sort((a, b) => (priority[a.status] || 4) - (priority[b.status] || 4) || a.port - b.port);
  } else if (sortMode === "service") {
    rows.sort((a, b) => a.service.localeCompare(b.service) || a.port - b.port);
  } else if (sortMode === "latency") {
    rows.sort((a, b) => a.response_ms - b.response_ms);
  }

  const body = el("resultsBody");

  if (rows.length === 0) {
    if (allResults.length === 0) {
      body.innerHTML = `
        <tr class="empty-row">
          <td colspan="5" class="empty-msg">No scan active. Enter a target and click <strong>▶ Start Port Scan</strong> to begin.</td>
        </tr>`;
    } else {
      body.innerHTML = `
        <tr class="empty-row">
          <td colspan="5" class="empty-msg">No ports match the current filter or search query.</td>
        </tr>`;
    }
    return;
  }

  const html = rows
    .map((r) => {
      const badgeCls = `badge-${r.status}`;
      const badgeText = r.status.toUpperCase();
      const bannerSafe = r.banner ? escapeHtml(r.banner) : "-";
      return `
        <tr>
          <td class="port-cell">${r.port}</td>
          <td><span class="badge ${badgeCls}"><span class="badge-dot"></span>${badgeText}</span></td>
          <td class="service-cell">${escapeHtml(r.service)}</td>
          <td class="banner-cell" title="${bannerSafe}">${bannerSafe}</td>
          <td class="latency-cell">${r.response_ms} ms</td>
        </tr>
      `;
    })
    .join("");

  body.innerHTML = html;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---- Export -----------------------------------------------------------
el("exportBtn").addEventListener("click", () => {
  if (!currentScanId || allResults.length === 0) {
    alert("Run a port scan first to export results.");
    return;
  }
  const fmt = el("exportFormat").value;
  window.location = `/api/scan/${currentScanId}/export?fmt=${fmt}`;
});
