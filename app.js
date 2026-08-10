// app.js -- NDPortX web client

const el = (id) => document.getElementById(id);

// ---- Ethics modal ----------------------------------------------------
el("agreeBtn").addEventListener("click", () => {
  el("ethicsModal").classList.add("hidden");
});

// ---- State -------------------------------------------------------------
let currentScanId = null;
let currentSource = null;
let allResults = [];
let scanTarget = "";
let lastDuration = 0;

const PRESETS_CACHE = {};

// ---- Presets -------------------------------------------------------------
fetch("/api/presets").then(r => r.json()).then(data => {
  Object.assign(PRESETS_CACHE, data);
});

el("presetSelect").addEventListener("change", (e) => {
  const name = e.target.value;
  const preset = PRESETS_CACHE[name];
  if (!preset) return;
  el("startPort").value = preset.min;
  el("endPort").value = preset.max;
});

// ---- Helpers -------------------------------------------------------------
function formatDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSpeed(count, duration) {
  if (duration <= 0) return "0.0 p/s";
  return `${(count / duration).toFixed(1)} p/s`;
}

function setStatus(text, cls) {
  const pill = el("statusPill");
  pill.textContent = text;
  pill.className = "status-pill " + cls;
}

// ---- Start scan -------------------------------------------------------------
el("startBtn").addEventListener("click", async () => {
  const target = el("targetInput").value.trim();
  const startPort = el("startPort").value;
  const endPort = el("endPort").value;
  const timeout = el("timeoutInput").value;
  const threads = el("threadsInput").value;

  el("targetStatus").textContent = "";
  el("targetStatus").style.color = "";

  const resp = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target, start_port: Number(startPort), end_port: Number(endPort),
      timeout: Number(timeout), threads: Number(threads),
    }),
  });
  const data = await resp.json();

  if (!resp.ok) {
    el("targetStatus").textContent = data.error || "Could not start scan.";
    el("targetStatus").style.color = "var(--error)";
    return;
  }

  scanTarget = target;
  clearResults(false);
  el("statTarget").textContent = target;
  el("statTotal").textContent = String(Number(endPort) - Number(startPort) + 1);
  el("targetStatus").textContent = `Resolved to ${data.resolved_ip}`;
  el("targetStatus").style.color = "var(--primary)";

  currentScanId = data.scan_id;
  el("startBtn").disabled = true;
  el("stopBtn").disabled = false;
  setStatus("● SCANNING", "running");

  openStream(currentScanId);
});

function openStream(scanId) {
  if (currentSource) currentSource.close();
  const source = new EventSource(`/api/scan/${scanId}/stream`);
  currentSource = source;

  source.onmessage = (e) => {
    const event = JSON.parse(e.data);
    if (event.type === "progress") handleProgress(event);
    else if (event.type === "result") handleResult(event.result);
    else if (event.type === "done") handleDone(event);
  };

  source.onerror = () => {
    source.close();
  };
}

function handleProgress(event) {
  const pct = event.total ? (event.done / event.total) * 100 : 0;
  el("progressBar").style.width = pct + "%";
  el("pctVal").textContent = Math.round(pct) + "%";
  el("elapsedVal").textContent = formatDuration(event.elapsed);
  el("remainingVal").textContent = String(event.total - event.done);
  const rate = event.done / (event.elapsed || 1);
  const etaSec = rate > 0 ? (event.total - event.done) / rate : 0;
  el("etaVal").textContent = formatDuration(etaSec);
  if (allResults.length) {
    el("curPortVal").textContent = allResults[allResults.length - 1].port;
  }
}

function handleResult(result) {
  allResults.push(result);
  refreshTable();
  const open = allResults.filter(r => r.status === "open").length;
  const closed = allResults.filter(r => r.status === "closed").length;
  const filtered = allResults.length - open - closed;
  el("statOpen").textContent = open;
  el("statClosed").textContent = closed;
  el("statFiltered").textContent = filtered;
}

function handleDone(event) {
  el("startBtn").disabled = false;
  el("stopBtn").disabled = true;
  lastDuration = event.duration;
  el("statDuration").textContent = formatDuration(event.duration);
  el("statSpeed").textContent = formatSpeed(event.total, event.duration);
  el("progressBar").style.width = "100%";
  el("pctVal").textContent = "100%";

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

// ---- Clear -------------------------------------------------------------
function clearResults(resetTarget = true) {
  allResults = [];
  el("resultsBody").innerHTML = "";
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
  if (resetTarget) el("statTarget").textContent = "-";
  setStatus("● IDLE", "idle");
}
el("clearBtn").addEventListener("click", () => {
  if (currentSource) currentSource.close();
  clearResults(true);
});

// ---- Search / filter / sort -------------------------------------------------------------
el("searchInput").addEventListener("keyup", refreshTable);
el("openOnly").addEventListener("change", refreshTable);
el("sortSelect").addEventListener("change", refreshTable);

function refreshTable() {
  const query = el("searchInput").value.trim().toLowerCase();
  const openOnly = el("openOnly").checked;
  const sortMode = el("sortSelect").value;

  let rows = [...allResults];
  if (openOnly) rows = rows.filter(r => r.status === "open");
  if (query) {
    rows = rows.filter(r =>
      String(r.port).includes(query) || r.service.toLowerCase().includes(query)
    );
  }
  if (sortMode === "service") {
    rows.sort((a, b) => a.service.localeCompare(b.service) || a.port - b.port);
  } else {
    rows.sort((a, b) => a.port - b.port);
  }

  const body = el("resultsBody");
  body.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.className = "status-" + r.status;
    tr.innerHTML = `
      <td>${r.port}</td>
      <td>${r.status.toUpperCase()}</td>
      <td>${r.service}</td>
      <td>${r.banner || "-"}</td>
      <td>${r.response_ms}</td>`;
    body.appendChild(tr);
  }
}

// ---- Export -------------------------------------------------------------
el("exportBtn").addEventListener("click", () => {
  if (!currentScanId || allResults.length === 0) {
    alert("Run a scan first.");
    return;
  }
  const fmt = el("exportFormat").value;
  window.location = `/api/scan/${currentScanId}/export?fmt=${fmt}`;
});
