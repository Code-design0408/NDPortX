# NDPortX (Web Edition)

A browser-based version of NDPortX: the same threaded TCP Connect
scan engine as the desktop app, exposed over a Flask API with a live dark
dashboard UI, so it can be hosted (e.g. on Render) and used from any browser.

> **Authorized use only.** This tool is intended solely for scanning systems
> you own or have explicit written permission to test. Unauthorized scanning
> may be illegal in your jurisdiction. Because this version is reachable by
> anyone with the URL, treat the link like a credential — don't publish it
> somewhere the public can reach it unless you actually want that.

## What changed from the desktop version

The original desktop app (CustomTkinter) draws native windows and
needs a display — that's why it failed on Render, which runs headless web
containers. This version keeps the same scan engine (`scanner.py`,
`validator.py`, `services.py`, `exporter.py`, `logger.py`, `utils.py`,
unchanged) but replaces the CustomTkinter GUI with:

- `server.py` — a Flask app exposing `/api/scan`, a Server-Sent Events
  stream for live progress, `/api/scan/<id>/stop`, and `/api/scan/<id>/export`
- `templates/index.html`, `static/style.css`, `static/app.js` — the browser
  dashboard (same dark SOC theme, port presets, progress bar, results table,
  search/filter, stats panel, export)

## Hosted-safety limits

Because a public URL means *anyone* could point this at *any* target through
your server's IP, `server.py` enforces some caps you can tune at the top of
the file:

- `MAX_PORTS_PER_SCAN` (default 3000)
- `MAX_THREADS` (default 150)
- `MAX_CONCURRENT_SCANS` (default 4, across all visitors)

If you want this fully private, put it behind Render's basic auth, a
password gate in `server.py`, or a VPN — this app itself doesn't include
login/auth.

## Run locally

```bash
pip install -r requirements.txt
python server.py
```

Then open http://127.0.0.1:5000 for the welcome page, or
http://127.0.0.1:5000/scanner to go straight to the dashboard.

## Author

Built by Nandani Dodeja
- GitHub: https://github.com/Code-design0408
- LinkedIn: https://www.linkedin.com/in/nandani-dodeja/

## Deploy on Render

1. Push this folder to a GitHub/GitLab repo.
2. In Render: **New +** → **Web Service** → connect the repo.
3. Render should auto-detect Python. If asked manually:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn server:app --worker-class gthread --workers 1 --threads 12 --timeout 120`
4. Deploy. Render assigns a public URL like `https://your-app.onrender.com`.

A `render.yaml` blueprint and a `Procfile` are included, so "New + → Blueprint"
also works directly from the repo.

### Why `--workers 1`

Scan state (running scanners, queued results) lives in this process's memory,
keyed by `scan_id`. With more than one gunicorn worker, a browser could start
a scan on worker A and then have its SSE stream or export request land on
worker B, which has never heard of that `scan_id`. `--threads 12` gives you
real concurrency (multiple simultaneous scans/streams) without that problem.
For heavier traffic, swap the in-memory dict for Redis and you can scale
workers horizontally.

### Render free tier notes

- Free services spin down after inactivity and cold-start on the next
  request — the first hit after idle may take ~30s.
- Ephemeral disk: files written to `exports/` and `logs/` disappear on
  restart/redeploy. Exports are streamed to the browser as a download at
  request time, so that's fine; logs are best-effort only on Render.

## Folder Structure

```
CyberPortScannerWeb/
├── server.py            # Flask app + API + SSE streaming
├── scanner.py            # Threaded TCP Connect scan engine (unchanged)
├── validator.py          # Input validation (unchanged)
├── exporter.py           # TXT / CSV / JSON export (unchanged)
├── services.py           # Port -> service map, presets (unchanged)
├── logger.py             # File-based scan/error logging (unchanged)
├── utils.py              # Shared helpers (unchanged)
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   └── app.js
├── exports/
├── logs/
├── requirements.txt
├── Procfile
├── render.yaml
└── README.md
```

## License

MIT License. Use responsibly and only against systems you are authorized to
test.
