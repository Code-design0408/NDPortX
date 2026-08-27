import fs from "node:fs";
import path from "node:path";

export const WELCOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NDPortX — TCP Port Scanner & Reconnaissance</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body class="welcome-body">

<div class="welcome-wrap">
  <div class="welcome-card">
    <div class="welcome-logo">⛨ NDPORTX</div>
    <p class="welcome-tagline">High-Speed TCP Reconnaissance & Port Auditing</p>

    <p class="welcome-desc">
      NDPortX scans target hosts across configurable port ranges, detects
      open/closed/filtered states, captures service banners, and streams live progress
      directly to your browser with export capabilities (CSV, JSON, TXT).
    </p>

    <div class="welcome-notice">
      ⚠ Authorized use only — scan only systems and networks you own or have explicit written permission to audit.
    </div>

    <a href="/scanner" class="btn btn-primary btn-block welcome-cta">Launch Scanner →</a>

    <div class="welcome-author">
      <span>Built by Nandani Dodeja</span>
      <div class="footer-links">
        <a href="https://github.com/Code-design0408" target="_blank" rel="noopener">GitHub</a>
        &middot;
        <a href="https://www.linkedin.com/in/nandani-dodeja/" target="_blank" rel="noopener">LinkedIn</a>
      </div>
    </div>
  </div>
</div>

</body>
</html>`;

export const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NDPortX — TCP Port Scanner & Reconnaissance</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>

<div id="ethicsModal" class="modal-overlay">
  <div class="modal-card">
    <div class="modal-icon">⛨</div>
    <h2>Authorized Security Auditing</h2>
    <p>
      NDPortX is an authorized network reconnaissance and port scanning tool. 
      Only scan targets, hosts, and IP addresses that you own or have explicit, documented 
      authorization to audit.
    </p>
    <button id="agreeBtn" class="btn btn-primary btn-block">I Understand &amp; Agree</button>
  </div>
</div>

<header class="app-header">
  <div class="header-left">
    <a href="/" class="logo-link"><span class="logo">⛨ NDPORTX</span></a>
    <span class="subtitle">High-Performance TCP Reconnaissance &amp; Port Auditing</span>
  </div>
  <div class="header-right">
    <a href="https://github.com/Code-design0408" target="_blank" rel="noopener" class="social-link" title="GitHub">GitHub</a>
    <a href="https://www.linkedin.com/in/nandani-dodeja/" target="_blank" rel="noopener" class="social-link" title="LinkedIn">LinkedIn</a>
    <div id="statusPill" class="status-pill idle">● IDLE</div>
  </div>
</header>

<main class="layout">
  <aside class="control-panel">

    <section class="card">
      <div class="card-header-row">
        <h3>Target Host / IP</h3>
      </div>
      <input id="targetInput" type="text" placeholder="e.g. scanme.nmap.org or 127.0.0.1" value="scanme.nmap.org">
      <div class="chip-row">
        <span class="chip-label">Quick:</span>
        <button type="button" class="target-chip" data-target="scanme.nmap.org">scanme.nmap.org</button>
        <button type="button" class="target-chip" data-target="127.0.0.1">127.0.0.1</button>
        <button type="button" class="target-chip" data-target="1.1.1.1">1.1.1.1</button>
        <button type="button" class="target-chip" data-target="8.8.8.8">8.8.8.8</button>
      </div>
      <div id="targetStatus" class="hint"></div>
    </section>

    <section class="card">
      <h3>Port Selection</h3>
      <div class="preset-wrapper">
        <label class="field-label">Preset Profile</label>
        <select id="presetSelect">
          <option value="Common Web">Common Web (15 web ports: 80, 443, 3000, 8080...)</option>
          <option value="Top 20">Top 20 Standard Services (SSH, HTTP, DNS, DBs...)</option>
          <option value="Top 100">Top 100 Common Ports</option>
          <option value="Standard 1-1024" selected>Standard Well-Known Ports (1 - 1024)</option>
          <option value="Top 1000">Top 1000 Ports</option>
          <option value="Custom">Custom Range / Port List</option>
        </select>
      </div>

      <div id="customPortSection" class="custom-ports hidden">
        <label class="field-label">Custom Ports or Range</label>
        <input id="customPortsInput" type="text" placeholder="e.g. 21, 22, 80, 443, 8000-8080">
        <div class="two-col">
          <div>
            <label class="field-label">Start Port</label>
            <input id="startPort" type="number" value="1" min="1" max="65535">
          </div>
          <div>
            <label class="field-label">End Port</label>
            <input id="endPort" type="number" value="1024" min="1" max="65535">
          </div>
        </div>
      </div>
      <div id="portCountInfo" class="hint count-highlight">Selected: 1,024 ports</div>
    </section>

    <section class="card">
      <h3>Scan Parameters</h3>
      <div class="two-col">
        <div>
          <label class="field-label">Timeout (sec)</label>
          <input id="timeoutInput" type="number" value="0.5" step="0.1" min="0.05" max="5">
        </div>
        <div>
          <label class="field-label">Concurrency (Threads)</label>
          <input id="threadsInput" type="number" value="100" min="10" max="150">
        </div>
      </div>
      <div class="hint">TCP 3-way handshake with banner identification.</div>
    </section>

    <div class="action-buttons">
      <button id="startBtn" class="btn btn-primary btn-block">▶ Start Port Scan</button>
      <div class="two-col gap">
        <button id="stopBtn" class="btn btn-danger" disabled>■ Stop</button>
        <button id="clearBtn" class="btn btn-muted">✕ Clear</button>
      </div>
      <div class="two-col gap">
        <select id="exportFormat">
          <option value="csv">Export CSV</option>
          <option value="json">Export JSON</option>
          <option value="txt">Export TXT</option>
        </select>
        <button id="exportBtn" class="btn btn-secondary">⬇ Download</button>
      </div>
    </div>
  </aside>

  <section class="results-panel">
    
    <!-- Realtime Progress Block -->
    <div class="card progress-card">
      <div class="progress-header">
        <span class="progress-title">Live Scan Progress</span>
        <span id="pctVal" class="progress-pct">0%</span>
      </div>
      <div class="progress-track">
        <div id="progressBar" class="progress-fill"></div>
      </div>
      <div class="stat-row progress-stats">
        <div class="stat-block"><span class="stat-label">Elapsed</span><span id="elapsedVal" class="stat-value">0:00</span></div>
        <div class="stat-block"><span class="stat-label">Current Port</span><span id="curPortVal" class="stat-value">-</span></div>
        <div class="stat-block"><span class="stat-label">Remaining</span><span id="remainingVal" class="stat-value">0</span></div>
        <div class="stat-block"><span class="stat-label">ETA</span><span id="etaVal" class="stat-value">0:00</span></div>
        <div class="stat-block"><span class="stat-label">Scan Rate</span><span id="statSpeed" class="stat-value">0.0 p/s</span></div>
      </div>
    </div>

    <!-- Live Status Overview Cards -->
    <div class="stat-grid">
      <div class="mini-stat-card target-card">
        <span class="mini-label">Target</span>
        <span id="statTarget" class="mini-value">-</span>
      </div>
      <div class="mini-stat-card total-card">
        <span class="mini-label">Scanned</span>
        <span id="statTotal" class="mini-value">0</span>
      </div>
      <div class="mini-stat-card open-card" id="filterCardOpen">
        <span class="mini-label">Open Ports</span>
        <span id="statOpen" class="mini-value text-open">0</span>
      </div>
      <div class="mini-stat-card closed-card" id="filterCardClosed">
        <span class="mini-label">Closed</span>
        <span id="statClosed" class="mini-value text-closed">0</span>
      </div>
      <div class="mini-stat-card filtered-card" id="filterCardFiltered">
        <span class="mini-label">Filtered</span>
        <span id="statFiltered" class="mini-value text-filtered">0</span>
      </div>
      <div class="mini-stat-card duration-card">
        <span class="mini-label">Duration</span>
        <span id="statDuration" class="mini-value">0:00</span>
      </div>
    </div>

    <!-- Filter & Results Table -->
    <div class="card table-card">
      <div class="table-toolbar">
        <div class="filter-tabs">
          <button class="filter-tab active" data-filter="all" id="tabAll">All (<span id="countAllTab">0</span>)</button>
          <button class="filter-tab tab-open" data-filter="open" id="tabOpen">Open (<span id="countOpenTab">0</span>)</button>
          <button class="filter-tab tab-closed" data-filter="closed" id="tabClosed">Closed (<span id="countClosedTab">0</span>)</button>
          <button class="filter-tab tab-filtered" data-filter="filtered" id="tabFiltered">Filtered (<span id="countFilteredTab">0</span>)</button>
        </div>

        <div class="table-controls">
          <input id="searchInput" type="text" placeholder="Filter by port or service...">
          <select id="sortSelect">
            <option value="port">Sort by Port (Asc)</option>
            <option value="port-desc">Sort by Port (Desc)</option>
            <option value="status">Sort by Status (Open first)</option>
            <option value="service">Sort by Service</option>
            <option value="latency">Sort by Latency (Fastest)</option>
          </select>
        </div>
      </div>

      <div class="table-wrap">
        <table id="resultsTable">
          <thead>
            <tr>
              <th style="width: 100px;">Port</th>
              <th style="width: 130px;">State</th>
              <th style="width: 180px;">Service</th>
              <th>Banner / Info</th>
              <th style="width: 120px; text-align: right;">Latency</th>
            </tr>
          </thead>
          <tbody id="resultsBody">
            <tr class="empty-row">
              <td colspan="5" class="empty-msg">No scan active. Enter a target and click <strong>▶ Start Port Scan</strong> to begin.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</main>

<footer class="app-footer">
  <span>NDPortX &middot; High-Speed Network Reconnaissance Tool</span>
  <div class="footer-links">
    <span>Built by Nandani Dodeja</span>
    &middot;
    <a href="https://github.com/Code-design0408" target="_blank" rel="noopener">GitHub</a>
    &middot;
    <a href="https://www.linkedin.com/in/nandani-dodeja/" target="_blank" rel="noopener">LinkedIn</a>
  </div>
</footer>

<script src="/static/app.js"></script>
</body>
</html>`;

export function getWelcomeHtml(): string {
  try {
    const p = path.join(process.cwd(), "templates", "welcome.html");
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  } catch {
    // fallback
  }
  return WELCOME_HTML;
}

export function getIndexHtml(): string {
  try {
    const p = path.join(process.cwd(), "templates", "index.html");
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  } catch {
    // fallback
  }
  return INDEX_HTML;
}
