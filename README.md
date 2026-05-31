# Enterprise Data Platform — Service Health Monitor

A frontend-only React prototype that simulates the **operational control plane** for an
Enterprise Data Platform at a large financial institution. It models the kind of
**Service Management Plane** a Platform PM would use to monitor DPaaS (Data Platform
as a Service) operations: pipeline health, SLA adherence, MTTR trends, and incident
volume across mission-critical financial data pipelines.

> Proof-of-work prototype. No backend, no API calls, all simulated data.

---

## What it shows

- **Top header** with overall platform status (auto-Degraded if any pipeline drops below 99.5% uptime)
- **KPI row** — Platform Uptime, Avg MTTR, Open Incidents, SLA Breaches (with trend deltas)
- **Pipeline Health table** for 6 simulated pipelines (Portfolio Valuation, Trade Settlement, Risk Analytics, Market Data, Regulatory Reporting, Client Holdings) — rows that breach SLA are highlighted in amber
- **MTTR Trend** line chart over the last 30 days with a 60-minute SLA reference line
- **Incident Volume** stacked bar chart by severity over the last 8 weeks
- **Recent Incidents log** with severity, MTTR, and resolution state
- **Footer** with attribution

Design is light, data-dense, and intentionally restrained — clean off-white surfaces,
subtle gray borders, emerald accent. The goal is to feel like an enterprise control
plane in the same family as Linear / Vercel / TaskPulse.

## Tech stack

- React 18 + Vite
- Tailwind CSS (light theme, custom palette)
- Recharts (line + bar charts)
- Inter via Google Fonts; JetBrains Mono for numeric/code-like cells

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

The repo is Vercel-ready. Either:

1. Push to GitHub and import the repo in the Vercel dashboard (framework is auto-detected as **Vite**), or
2. From the project root:

```bash
npx vercel
npx vercel --prod
```

`vercel.json` pins the framework, build command, and output directory.

## File layout

```
.
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── vercel.json
├── public/
│   └── favicon.svg
└── src/
    ├── App.jsx        # Entire dashboard (sections, data, charts, presentational primitives)
    ├── index.css      # Tailwind layers + dark-theme polish (scrollbar, Recharts tooltip skin)
    └── main.jsx       # React entry
```

## Design notes

- **Determinism**: simulated time-series are generated with a seeded PRNG so charts
  don't reshuffle on every render. A real product would pull this from a metrics
  store; the shape of the data here is what matters.
- **Status logic**: the platform-wide badge derives from pipeline-level uptime
  (any pipeline below 99.5% → Degraded). Risk Analytics Ingestion at 99.43%
  intentionally trips this, mirroring the open P1 in the incidents log.
- **Color usage**: status colors are reserved for status (green/amber/red). The
  accent blue is used sparingly for interactive affordances and chart series.
- **Typography**: numeric cells use tabular-nums + JetBrains Mono so columns
  align vertically — a small detail that matters in ops tables.
