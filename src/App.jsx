import React, { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

/* ──────────────────────────────────────────────────────────────────────────
 *  Static seed data for the simulated DPaaS control plane.
 *  Numbers are crafted to look like a realistic operations week:
 *    – one Degraded pipeline (Risk Analytics) currently driving an open P1
 *    – the rest Healthy but with normal incident churn
 *  Keep this section close to the top so a reviewer can scan the inputs
 *  before diving into the rendering.
 * ────────────────────────────────────────────────────────────────────────── */

const PIPELINES = [
  {
    name: 'Portfolio Valuation Feed',
    domain: 'Investments',
    status: 'Healthy',
    uptime: 99.97,
    sla: 99.95,
    mttr: 22,
    lastIncident: '3 days ago',
    incidents30d: 1,
    trend: 'up',
  },
  {
    name: 'Trade Settlement Pipeline',
    domain: 'Operations',
    status: 'Healthy',
    uptime: 99.91,
    sla: 99.9,
    mttr: 41,
    lastIncident: '1 day ago',
    incidents30d: 2,
    trend: 'flat',
  },
  {
    name: 'Risk Analytics Ingestion',
    domain: 'Risk',
    status: 'Degraded',
    uptime: 99.43,
    sla: 99.5,
    mttr: 87,
    lastIncident: '6 hours ago',
    incidents30d: 5,
    trend: 'down',
  },
  {
    name: 'Market Data Normalizer',
    domain: 'Market Data',
    status: 'Healthy',
    uptime: 99.98,
    sla: 99.95,
    mttr: 18,
    lastIncident: '8 days ago',
    incidents30d: 1,
    trend: 'up',
  },
  {
    name: 'Regulatory Reporting Stream',
    domain: 'Compliance',
    status: 'Healthy',
    uptime: 99.89,
    sla: 99.85,
    mttr: 33,
    lastIncident: '5 days ago',
    incidents30d: 2,
    trend: 'flat',
  },
  {
    name: 'Client Holdings Aggregator',
    domain: 'Client Reporting',
    status: 'Healthy',
    uptime: 99.96,
    sla: 99.95,
    mttr: 29,
    lastIncident: '2 days ago',
    incidents30d: 1,
    trend: 'up',
  },
]

const INCIDENTS = [
  {
    id: 'INC-0041',
    pipeline: 'Risk Analytics Ingestion',
    severity: 'P1',
    description: 'Schema validation failure on upstream feed',
    detected: 'Today 09:14',
    resolved: 'Open',
    mttr: null,
    status: 'Open',
  },
  {
    id: 'INC-0040',
    pipeline: 'Trade Settlement Pipeline',
    severity: 'P2',
    description: 'Throughput degradation, queue depth spike',
    detected: 'Yesterday 14:32',
    resolved: 'Yesterday 16:55',
    mttr: 143,
    status: 'Resolved',
  },
  {
    id: 'INC-0039',
    pipeline: 'Risk Analytics Ingestion',
    severity: 'P2',
    description: 'Latency breach on batch job',
    detected: '3 days ago',
    resolved: '3 days ago',
    mttr: 67,
    status: 'Resolved',
  },
  {
    id: 'INC-0038',
    pipeline: 'Client Holdings Aggregator',
    severity: 'P3',
    description: 'Data freshness SLA miss (12 min delay)',
    detected: '4 days ago',
    resolved: '4 days ago',
    mttr: 28,
    status: 'Resolved',
  },
  {
    id: 'INC-0037',
    pipeline: 'Portfolio Valuation Feed',
    severity: 'P1',
    description: 'Connection timeout to source system',
    detected: '6 days ago',
    resolved: '6 days ago',
    mttr: 22,
    status: 'Resolved',
  },
]

const KPIS = [
  {
    label: 'Platform Uptime',
    value: '99.94%',
    delta: '+0.03%',
    deltaDirection: 'up',
    deltaIsGood: true,
    sub: 'vs. last 30d',
    icon: 'shield',
  },
  {
    label: 'Avg MTTR',
    value: '38 mins',
    delta: '-12%',
    deltaDirection: 'down',
    deltaIsGood: true,
    sub: 'vs. last month',
    icon: 'clock',
  },
  {
    label: 'Open Incidents',
    value: '3',
    delta: '+1',
    deltaDirection: 'up',
    deltaIsGood: false,
    sub: 'vs. last week',
    icon: 'alert',
  },
  {
    label: 'SLA Breaches (30d)',
    value: '1',
    delta: '0',
    deltaDirection: 'flat',
    deltaIsGood: true,
    sub: 'vs. last month',
    icon: 'target',
  },
]

/* ──────────────────────────────────────────────────────────────────────────
 *  Deterministic PRNG so the simulated time-series is stable across reloads.
 *  A real product would pull this from a metrics store; here we want
 *  charts that look "operationally believable" but never jitter on refresh.
 * ────────────────────────────────────────────────────────────────────────── */
function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function formatShortDate(d) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Build 30 days of MTTR readings for the three headline pipelines.
 * Each series has a baseline + jitter, with "incident windows" that
 * realistically spike MTTR (e.g. Risk Analytics' recent degradation).
 */
function buildMttrSeries() {
  const rand = mulberry32(20260531)
  const days = 30
  const today = new Date()

  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dayIndex = days - 1 - i // 0 = oldest, 29 = today

    const jitter = (base, spread) => Math.round(base + (rand() - 0.5) * spread)

    // Risk Analytics: baseline ~55, persistent elevation in last ~9 days
    let risk = jitter(55, 18)
    if (dayIndex >= 21) risk = jitter(95, 30)
    if (dayIndex >= 27) risk = jitter(120, 35)

    // Trade Settlement: baseline ~40, mid-period spike around day 8-11
    let trade = jitter(38, 14)
    if (dayIndex >= 8 && dayIndex <= 11) trade = jitter(95, 25)
    if (dayIndex === 28) trade = jitter(70, 10) // recent P2

    // Portfolio Valuation: very stable, single spike around day 23 (INC-0037)
    let portfolio = jitter(24, 8)
    if (dayIndex === 23) portfolio = jitter(110, 20)

    series.push({
      date: formatShortDate(d),
      'Risk Analytics Ingestion': Math.max(8, risk),
      'Trade Settlement Pipeline': Math.max(8, trade),
      'Portfolio Valuation Feed': Math.max(8, portfolio),
    })
  }
  return series
}

/**
 * 8-week incident volume. P1 stays low (0-2). P2/P3 cluster 2-6.
 * Week 8 is the current week and intentionally reflects the live
 * incident log: 2 P1s (INC-0037, INC-0041) and 3 P2/P3s.
 */
function buildIncidentVolume() {
  const rand = mulberry32(99887766)
  const weeks = 8
  const out = []
  for (let i = 1; i <= weeks; i++) {
    if (i === weeks) {
      out.push({ week: `Week ${i}`, P1: 2, 'P2/P3': 3 })
      continue
    }
    const p1 = Math.floor(rand() * 2.4) // 0..2
    const p23 = 2 + Math.floor(rand() * 5) // 2..6
    out.push({ week: `Week ${i}`, P1: p1, 'P2/P3': p23 })
  }
  return out
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Small presentational primitives.
 *  Kept inline (vs. extracted modules) to match the brief's
 *  "single file / minimal structure" guidance.
 * ────────────────────────────────────────────────────────────────────────── */

function Icon({ name, className = 'h-4 w-4' }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
  }
  switch (name) {
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case 'alert':
      return (
        <svg {...common}>
          <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      )
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'pulse':
      return (
        <svg {...common}>
          <path d="M3 12h4l2-7 4 14 2-7h6" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
          <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
          <path d="M21 3v5h-5M3 21v-5h5" />
        </svg>
      )
    case 'arrowUp':
      return (
        <svg {...common}>
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      )
    case 'arrowDown':
      return (
        <svg {...common}>
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      )
    case 'arrowRight':
      return (
        <svg {...common}>
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      )
    default:
      return null
  }
}

function StatusBadge({ status }) {
  const map = {
    Healthy: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Degraded: 'bg-amber-50 text-amber-700 ring-amber-200',
    Critical: 'bg-red-50 text-red-700 ring-red-200',
    Open: 'bg-red-50 text-red-700 ring-red-200',
    Resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  }
  const dotColor = {
    Healthy: 'bg-emerald-500',
    Degraded: 'bg-amber-500',
    Critical: 'bg-red-500',
    Open: 'bg-red-500',
    Resolved: 'bg-emerald-500',
  }[status]
  const pulse = status === 'Open' || status === 'Degraded' || status === 'Critical'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ring-1 ring-inset ${map[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${pulse ? 'animate-pulse-soft' : ''}`} />
      {status}
    </span>
  )
}

function SeverityBadge({ severity }) {
  const map = {
    P1: 'bg-red-50 text-red-700 ring-red-200',
    P2: 'bg-amber-50 text-amber-700 ring-amber-200',
    P3: 'bg-slate-100 text-slate-700 ring-slate-200',
  }
  return (
    <span
      className={`mono inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${map[severity]}`}
    >
      {severity}
    </span>
  )
}

function TrendArrow({ direction, className = 'h-4 w-4' }) {
  if (direction === 'up') return <Icon name="arrowUp" className={`${className} text-emerald-600`} />
  if (direction === 'down') return <Icon name="arrowDown" className={`${className} text-red-600`} />
  return <Icon name="arrowRight" className={`${className} text-gray-400`} />
}

function Card({ title, subtitle, action, children, className = '', delay = 0 }) {
  return (
    <section
      className={`animate-fade-in rounded-xl border border-border-subtle bg-bg-card shadow-card ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-3.5">
          <div>
            {title && <h2 className="text-[13px] font-semibold tracking-wide text-gray-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Sections
 * ────────────────────────────────────────────────────────────────────────── */

function Header({ lastRefreshed, onRefresh, platformStatus }) {
  const isDegraded = platformStatus === 'Degraded'
  return (
    <header className="animate-fade-in border-b border-border-subtle bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200">
            <Icon name="pulse" className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-gray-900 md:text-xl">
              Enterprise Data Platform <span className="text-gray-400">—</span> Service Health Monitor
            </h1>
            <p className="mt-0.5 text-xs text-gray-500 md:text-sm">
              Operational Control Plane <span className="mx-1.5 text-gray-300">·</span> Simulated Environment
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="mono hidden items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-[11px] uppercase tracking-wider text-gray-500 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> env · prod · us-east-1
          </span>
          <span className="mono inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-[11px] text-gray-600">
            <Icon name="refresh" className="h-3 w-3 text-gray-400" />
            Last refreshed {lastRefreshed}
          </span>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-white px-2.5 py-1 text-xs text-gray-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <Icon name="refresh" className="h-3.5 w-3.5" />
            Refresh
          </button>
          <span
            className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
              isDegraded
                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isDegraded ? 'bg-amber-500 animate-pulse-soft' : 'bg-emerald-500'
              }`}
            />
            {isDegraded ? 'Degraded' : 'All Systems Operational'}
          </span>
        </div>
      </div>
    </header>
  )
}

function KpiCard({ kpi, delay }) {
  const isUp = kpi.deltaDirection === 'up'
  const isFlat = kpi.deltaDirection === 'flat'
  const tone = kpi.deltaIsGood ? 'text-emerald-600' : 'text-red-600'
  return (
    <div
      className="animate-fade-in group relative overflow-hidden rounded-xl border border-border-subtle bg-bg-card p-4 shadow-card transition hover:border-emerald-300 hover:shadow-card-hover"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{kpi.label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200/70">
          <Icon name={kpi.icon} className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="mono text-2xl font-semibold tracking-tight text-gray-900">{kpi.value}</div>
        <div className={`flex items-center gap-1 text-xs font-medium ${isFlat ? 'text-gray-400' : tone}`}>
          <Icon
            name={isUp ? 'arrowUp' : isFlat ? 'arrowRight' : 'arrowDown'}
            className="h-3.5 w-3.5"
          />
          <span className="mono">{kpi.delta}</span>
        </div>
      </div>
      <div className="mt-1 text-[11px] text-gray-500">{kpi.sub}</div>
    </div>
  )
}

function PipelineTable() {
  return (
    <Card
      title="Pipeline Health"
      subtitle="Real-time status across mission-critical data pipelines"
      action={
        <span className="mono text-[11px] uppercase tracking-wider text-gray-500">
          {PIPELINES.length} pipelines
        </span>
      }
      delay={300}
    >
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">
              <th className="px-5 py-2.5 font-medium">Pipeline</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-right">Uptime %</th>
              <th className="px-3 py-2.5 font-medium text-right">SLA Target</th>
              <th className="px-3 py-2.5 font-medium text-right">MTTR</th>
              <th className="px-3 py-2.5 font-medium">Last Incident</th>
              <th className="px-3 py-2.5 font-medium text-right">Incidents (30d)</th>
              <th className="px-5 py-2.5 font-medium text-center">Trend</th>
            </tr>
          </thead>
          <tbody>
            {PIPELINES.map((p) => {
              const breached = p.uptime < p.sla
              return (
                <tr
                  key={p.name}
                  className={`border-b border-border-subtle/70 transition hover:bg-gray-50 ${
                    breached ? 'bg-amber-50/60' : ''
                  }`}
                >
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="mt-0.5 text-[11px] text-gray-500">{p.domain}</div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td
                    className={`mono px-3 py-3 text-right tabular-nums ${
                      breached ? 'text-amber-700 font-medium' : 'text-gray-800'
                    }`}
                  >
                    {p.uptime.toFixed(2)}%
                  </td>
                  <td className="mono px-3 py-3 text-right tabular-nums text-gray-500">
                    {p.sla.toFixed(2)}%
                  </td>
                  <td className="mono px-3 py-3 text-right tabular-nums text-gray-700">
                    {p.mttr} <span className="text-gray-400">m</span>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{p.lastIncident}</td>
                  <td className="mono px-3 py-3 text-right tabular-nums text-gray-700">{p.incidents30d}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-center">
                      <TrendArrow direction={p.trend} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function MttrTrendChart({ data }) {
  return (
    <Card
      title="MTTR Trend"
      subtitle="Mean time to recover · last 30 days · minutes"
      action={
        <span className="mono text-[11px] uppercase tracking-wider text-gray-500">
          target ≤ 60m
        </span>
      }
      delay={400}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              minTickGap={24}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={42}
              tickFormatter={(v) => `${v}m`}
            />
            <Tooltip
              cursor={{ stroke: '#9ca3af', strokeWidth: 1 }}
              formatter={(value) => [`${value} mins`, '']}
            />
            <ReferenceLine
              y={60}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{
                value: 'SLA target 60m',
                position: 'insideTopRight',
                fill: '#b45309',
                fontSize: 10,
              }}
            />
            <Legend
              iconType="plainline"
              verticalAlign="top"
              align="right"
              height={28}
              wrapperStyle={{ paddingBottom: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Portfolio Valuation Feed"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="Trade Settlement Pipeline"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="Risk Analytics Ingestion"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function IncidentVolumeChart({ data }) {
  return (
    <Card
      title="Incident Volume"
      subtitle="By severity · last 8 weeks"
      action={
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-red-500" /> P1
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-amber-500" /> P2/P3
          </span>
        </div>
      }
      delay={500}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tick={{ fontSize: 11 }}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={36} />
            <Tooltip cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
            <Bar dataKey="P1" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
            <Bar dataKey="P2/P3" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function IncidentsTable() {
  return (
    <Card
      title="Recent Incidents"
      subtitle="Last 7 days · click through in production for runbook & timeline"
      action={
        <span className="mono text-[11px] uppercase tracking-wider text-gray-500">
          {INCIDENTS.filter((i) => i.status === 'Open').length} open · {INCIDENTS.length} total
        </span>
      }
      delay={600}
    >
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">
              <th className="px-5 py-2.5 font-medium">Incident</th>
              <th className="px-3 py-2.5 font-medium">Pipeline</th>
              <th className="px-3 py-2.5 font-medium">Severity</th>
              <th className="px-3 py-2.5 font-medium">Description</th>
              <th className="px-3 py-2.5 font-medium">Detected</th>
              <th className="px-3 py-2.5 font-medium">Resolved</th>
              <th className="px-3 py-2.5 font-medium text-right">MTTR</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {INCIDENTS.map((i) => (
              <tr
                key={i.id}
                className={`border-b border-border-subtle/70 transition hover:bg-gray-50 ${
                  i.status === 'Open' ? 'bg-red-50/60' : ''
                }`}
              >
                <td className="mono px-5 py-3 text-gray-700">{i.id}</td>
                <td className="px-3 py-3 text-gray-800">{i.pipeline}</td>
                <td className="px-3 py-3">
                  <SeverityBadge severity={i.severity} />
                </td>
                <td className="px-3 py-3 text-gray-600">{i.description}</td>
                <td className="mono px-3 py-3 text-gray-600">{i.detected}</td>
                <td className="mono px-3 py-3 text-gray-600">
                  {i.resolved === 'Open' ? <span className="font-medium text-red-600">Open</span> : i.resolved}
                </td>
                <td className="mono px-3 py-3 text-right tabular-nums text-gray-700">
                  {i.mttr ? `${i.mttr} m` : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={i.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-border-subtle bg-white/60">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-6 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
        <p className="max-w-2xl leading-relaxed">
          Simulated environment for demonstration purposes. Built to model DPaaS operational observability
          for enterprise financial infrastructure.
        </p>
        <p className="flex items-center gap-2">
          <span>Designed &amp; built by</span>
          <span className="font-medium text-gray-800">Rishi</span>
          <span className="text-gray-300">·</span>
          <a
            href="https://www.linkedin.com/in/your-handle"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-600 transition hover:text-emerald-700"
          >
            LinkedIn
          </a>
        </p>
      </div>
    </footer>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Root
 * ────────────────────────────────────────────────────────────────────────── */

function formatTimestamp(d) {
  const date = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  return `${date} · ${time}`
}

export default function App() {
  const [lastRefreshed, setLastRefreshed] = useState(() => formatTimestamp(new Date()))

  // Build the simulated time-series once. Deterministic, so re-renders
  // (e.g. tooltip hover) never reshuffle the charts.
  const mttrSeries = useMemo(() => buildMttrSeries(), [])
  const incidentVolume = useMemo(() => buildIncidentVolume(), [])

  // Platform-wide status: Degraded if any pipeline is under 99.5% uptime.
  const platformStatus = useMemo(
    () => (PIPELINES.some((p) => p.uptime < 99.5) ? 'Degraded' : 'Operational'),
    [],
  )

  // Light "live feel" — increment the clock once a minute. Cheap and avoids
  // a stale timestamp without doing anything network-y.
  useEffect(() => {
    const id = setInterval(() => setLastRefreshed(formatTimestamp(new Date())), 60_000)
    return () => clearInterval(id)
  }, [])

  const handleRefresh = () => setLastRefreshed(formatTimestamp(new Date()))

  return (
    <div className="min-h-screen bg-bg-base text-gray-800">
      <div className="bg-grid">
        <div className="glow-emerald">
          <Header
            lastRefreshed={lastRefreshed}
            onRefresh={handleRefresh}
            platformStatus={platformStatus}
          />
        </div>

        <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
          {/* KPI row */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KPIS.map((k, idx) => (
              <KpiCard key={k.label} kpi={k} delay={idx * 80} />
            ))}
          </section>

          {/* Pipeline table */}
          <PipelineTable />

          {/* Two-column chart row */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <MttrTrendChart data={mttrSeries} />
            <IncidentVolumeChart data={incidentVolume} />
          </section>

          {/* Incidents log */}
          <IncidentsTable />
        </main>

        <Footer />
      </div>
    </div>
  )
}
