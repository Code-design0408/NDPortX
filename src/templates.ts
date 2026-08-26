import fs from "node:fs";
import path from "node:path";

export const WELCOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NDPortX — Authorized Port Scanner</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body class="welcome-body">

<div class="welcome-wrap">
  <div class="welcome-card">
    <div class="welcome-logo">⛨ NDPORTX</div>
    <p class="welcome-tagline">Fast, threaded TCP port scanning from your browser.</p>

    <p class="welcome-desc">
      NDPortX scans a target host across a chosen port range, identifies
      well-known services, shows live progress, and lets you export results
      to TXT, CSV, or JSON — all from a browser tab, no install required.
    </p>

    <div class="welcome-notice">
      ⚠ For authorized use only — scan only systems you own or have explicit
      permission to test.
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
<title>NDPortX</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>

<div id="ethicsModal" class="modal-overlay">
  <div class="modal-card">
    <h2>⚠ Authorized Use Only</h2>
    <p>
      NDPortX is intended only for scanning systems you own or have
      explicit permission to test. Unauthorized scanning of networks or
      systems may be illegal in your jurisdiction. By continuing, you confirm
      you have authorization to scan the target(s) you enter.
    </p>
    <button id="agreeBtn" class="btn btn-primary">I Understand &amp; Agree</button>
  </div>
</div>

<header class="app-header">
  <div class="header-left">
    <a href="/" class="logo-link"><span class="logo">⛨ NDPORTX</span></a>
    <span class="subtitle">Authorized network reconnaissance &amp; port auditing</span>
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
      <h3>Target</h3>
      <input id="targetInput" type="text" placeholder="e.g. 192.168.1.1 or example.com">
      <div id="targetStatus" class="hint"></div>
    </section>

    <section class="card">
      <h3>Scan Type</h3>
      <label class="radio-row">
        <input type="radio" name="scanType" checked disabled> TCP Connect
      </label>
    </section>

    <section class="card">
      <h3>Port Range</h3>
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
      <select id="presetSelect">
        <option value="Custom">Custom</option>
        <option value="Top 100">Top 100</option>
        <option value="Top 1000">Top 1000</option>
        <option value="Common Web">Common Web</option>
      </select>
    </section>

    <section class="card">
      <h3>Performance</h3>
      <div class="two-col">
        <div>
          <label class="field-label">Timeout (s)</label>
          <input id="timeoutInput" type="number" value="0.5" step="0.1" min="0.05" max="30">
        </div>
        <div>
          <label class="field-label">Threads</label>
          <input id="threadsInput" type="number" value="100" min="1" max="150">
        </div>
      </div>
      <div class="hint">Hosted limits: up to 150 threads, 3000 ports/scan.</div>
    </section>

    <button id="startBtn" class="btn btn-primary btn-block">▶ Start Scan</button>
    <div class="two-col gap">
      <button id="stopBtn" class="btn btn-danger" disabled>■ Stop</button>
      <button id="clearBtn" class="btn btn-muted">✕ Clear</button>
    </div>
    <div class="two-col gap">
      <select id="exportFormat">
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
        <option value="txt">TXT</option>
      </select>
      <button id="exportBtn" class="btn btn-secondary">⬇ Export</button>
    </div>
  </aside>

  <section class="results-panel">
    <div class="card progress-card">
      <div class="progress-track">
        <div id="progressBar" class="progress-fill"></div>
      </div>
      <div class="stat-row">
        <div class="stat-block"><span class="stat-label">Progress</span><span id="pctVal" class="stat-value">0%</span></div>
        <div class="stat-block"><span class="stat-label">Current Port</span><span id="curPortVal" class="stat-value">-</span></div>
        <div class="stat-block"><span class="stat-label">Elapsed</span><span id="elapsedVal" class="stat-value">0:00</span></div>
        <div class="stat-block"><span class="stat-label">Remaining</span><span id="remainingVal" class="stat-value">0</span></div>
        <div class="stat-block"><span class="stat-label">ETA</span><span id="etaVal" class="stat-value">0:00</span></div>
      </div>
    </div>

    <div class="card stat-card">
      <div class="stat-row">
        <div class="stat-block"><span class="stat-label">Target</span><span id="statTarget" class="stat-value">-</span></div>
        <div class="stat-block"><span class="stat-label">Total Ports</span><span id="statTotal" class="stat-value">0</span></div>
        <div class="stat-block"><span class="stat-label">Open</span><span id="statOpen" class="stat-value">0</span></div>
        <div class="stat-block"><span class="stat-label">Closed</span><span id="statClosed" class="stat-value">0</span></div>
        <div class="stat-block"><span class="stat-label">Filtered</span><span id="statFiltered" class="stat-value">0</span></div>
        <div class="stat-block"><span class="stat-label">Duration</span><span id="statDuration" class="stat-value">0:00</span></div>
        <div class="stat-block"><span class="stat-label">Speed</span><span id="statSpeed" class="stat-value">0.0 p/s</span></div>
      </div>
    </div>

    <div class="card table-card">
      <div class="toolbar">
        <input id="searchInput" type="text" placeholder="Search by port or service...">
        <label class="checkbox-row">
          <input id="openOnly" type="checkbox"> Open Only
        </label>
        <select id="sortSelect">
          <option value="port">Sort by Port</option>
          <option value="service">Sort by Service</option>
        </select>
      </div>
      <div class="table-wrap">
        <table id="resultsTable">
          <thead>
            <tr>
              <th>Port</th>
              <th>Status</th>
              <th>Service</th>
              <th>Banner</th>
              <th>Response (ms)</th>
            </tr>
          </thead>
          <tbody id="resultsBody"></tbody>
        </table>
      </div>
    </div>
  </section>
</main>

<footer class="app-footer">
  <span>NDPortX &middot; Fast TCP Port Scanner</span>
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
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  } catch (e) {
    // fallback
  }
  return WELCOME_HTML;
}

export function getIndexHtml(): string {
  try {
    const p = path.join(process.cwd(), "templates", "index.html");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  } catch (e) {
    // fallback
  }
  return INDEX_HTML;
}
