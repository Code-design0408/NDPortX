# NDPortX (Web Edition)

Authorized network reconnaissance & port auditing web dashboard. Built with a fast asynchronous TCP socket scan engine in TypeScript, Server-Sent Events (SSE) for live streaming progress, and a cyber-themed dashboard UI ready for deployment on **Vercel** or any Node.js environment.

> **Authorized use only.** This tool is intended solely for scanning systems you own or have explicit written permission to test. Unauthorized scanning of networks or systems may be illegal in your jurisdiction.

---

## Features

- **Asynchronous TCP Connect Scanner**: Fast non-blocking socket checks with configurable timeouts, thread concurrency, and automated banner grabbing.
- **Real-Time Live Updates**: Streams active scan statistics, port discovery events, elapsed duration, ETA, and progress over Server-Sent Events (SSE).
- **Interactive Control Dashboard**: Search and filter by port or service, view banner disclosures, response latencies, and export results in CSV, JSON, or TXT format.
- **Port Presets**: Quick select for Top 100, Top 1000, and Common Web ports.
- **Vercel Serverless Ready**: Configured for seamless deployment to Vercel via `@vercel/node` rewrites and ephemeral filesystem support.

---

## Project Structure

```
.
├── api/
│   └── index.ts          # Vercel Serverless entrypoint
├── src/
│   ├── app.ts            # Express application routing & SSE endpoints
│   ├── scanner.ts        # Asynchronous TCP scanner & banner grabber
│   ├── validator.ts      # Target DNS & port range validators
│   ├── exporter.ts       # CSV, JSON, TXT report exporter
│   ├── services.ts       # Common ports and service presets dictionary
│   ├── logger.ts         # Logging utility with serverless tmpdir support
│   └── utils.ts          # Stopwatch, date formatters, and helpers
├── static/
│   ├── app.js            # Client-side dashboard logic & SSE listener
│   └── style.css         # Dark theme dashboard styles
├── templates/
│   ├── index.html        # Main scanner dashboard
│   └── welcome.html      # Welcome page
├── vercel.json           # Vercel routing configuration
├── package.json          # Node dependencies & npm scripts
├── tsconfig.json         # TypeScript configuration
└── server.ts             # Standalone development & production server
```

---

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploying to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In the [Vercel Dashboard](https://vercel.com/new), select **"Add New Project"** and import your repository.
3. Keep default settings (`vercel.json` and `api/index.ts` are pre-configured).
4. Click **Deploy**.

---

## License

MIT License. Use responsibly and only against systems you are authorized to test.
