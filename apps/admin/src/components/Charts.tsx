'use client';

import { useState } from 'react';

// Dependency-free SVG charts for the admin dashboard. Muted two-tone palette
// (glacier blues + slate greys) so the console reads professional, not rainbow.

export interface Slice {
  name: string;
  value: number;
}

// Brand ramp: Naijavend blues (#1D4ED8 family) + cool slate greys.
const PALETTE = ['#1d4ed8', '#3b82f6', '#7fb2f0', '#1e3fa8', '#93c4e8', '#46617f', '#a9bdd4', '#6d7f99'];

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

/** Donut/pie chart with legend and hover tooltips. */
export function DonutChart({ slices, size = 180, money = false }: { slices: Slice[]; size?: number; money?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <p className="muted" style={{ fontSize: 13 }}>No data yet.</p>;

  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -Math.PI / 2;

  const arcs = slices.map((s, i) => {
    const frac = s.value / total;
    const a1 = angle;
    const a2 = angle + frac * Math.PI * 2;
    angle = a2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    return { ...s, i, frac, d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: PALETTE[i % PALETTE.length] };
  });

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} role="img" aria-label="Distribution chart" style={{ flexShrink: 0 }}>
        {arcs.map((a) => (
          <path
            key={a.name}
            d={a.d}
            fill={a.color}
            opacity={hover === null || hover === a.i ? 1 : 0.35}
            onMouseEnter={() => setHover(a.i)}
            onMouseLeave={() => setHover(null)}
            style={{ transition: 'opacity 0.15s ease', cursor: 'pointer' }}
          />
        ))}
        {hover !== null && (
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor">
            {money ? naira(arcs[hover].value) : arcs[hover].value.toLocaleString()}
          </text>
        )}
        {hover !== null && (
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10.5" fill="var(--ac-dim, #8ea0bd)">
            {arcs[hover].name}
          </text>
        )}
      </svg>
      <ul className="chart-legend">
        {arcs.map((a) => (
          <li key={a.name} onMouseEnter={() => setHover(a.i)} onMouseLeave={() => setHover(null)}>
            <i style={{ background: a.color }} />
            <span>{a.name}</span>
            <strong>{money ? naira(a.value) : a.value.toLocaleString()}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Smooth single-series area/line chart (revenue trend, visits trend). */
export function AreaChart({
  points,
  height = 170,
  money = false,
  label = 'trend',
}: {
  points: Array<{ day: string; value: number }>;
  height?: number;
  money?: boolean;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return <p className="muted" style={{ fontSize: 13 }}>No data yet.</p>;

  const W = 560;
  const H = height;
  const pad = 6;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = (W - pad * 2) / Math.max(1, points.length - 1);
  const xy = points.map((p, i) => ({
    x: pad + i * stepX,
    y: H - pad - (p.value / max) * (H - pad * 2 - 10),
    ...p,
  }));

  const line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${xy[xy.length - 1].x.toFixed(1)} ${H - pad} L ${xy[0].x.toFixed(1)} ${H - pad} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={label}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke="var(--ac-blue, #1d4ed8)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {xy.map((p, i) => (
          <g key={p.day}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? 4.5 : 2.5}
              fill={hover === i ? 'var(--ac-blue-deep, #1e3fa8)' : 'var(--ac-blue, #1d4ed8)'}
              style={{ transition: 'r 0.1s ease' }}
            />
            {/* fat invisible hit area per point */}
            <rect
              x={p.x - stepX / 2}
              y={0}
              width={stepX}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
        {hover !== null && xy[hover] && (
          <text
            x={Math.min(W - 90, Math.max(90, xy[hover].x))}
            y={16}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="currentColor"
          >
            {xy[hover].day.slice(5)} · {money ? naira(xy[hover].value) : xy[hover].value.toLocaleString()}
          </text>
        )}
      </svg>
      <div className="trend-axis" style={{ marginTop: 4 }}>
        {points
          .filter((_, i) => i % Math.ceil(points.length / 6) === 0 || i === points.length - 1)
          .map((p) => (
            <span key={p.day}>{p.day.slice(5)}</span>
          ))}
      </div>
    </div>
  );
}

/** Grouped bar chart per day (trend) with two series — muted. */
export function TrendBars({ days }: { days: Array<{ day: string; sellers: number; customers: number }> }) {
  const max = Math.max(1, ...days.map((d) => d.sellers + d.customers));
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div>
      <div className="trend-bars" role="img" aria-label="Signups per day, last 14 days">
        {days.map((d, i) => (
          <div
            key={d.day}
            className="trend-col"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            title={`${d.day}: ${d.sellers} sellers, ${d.customers} customers`}
          >
            <div className="trend-stack" style={{ height: `${((d.sellers + d.customers) / max) * 100}%` }}>
              <i className="trend-seg sellers" style={{ flexGrow: d.sellers }} />
              <i className="trend-seg customers" style={{ flexGrow: d.customers }} />
            </div>
          </div>
        ))}
      </div>
      <div className="trend-axis">
        {days.map((d, i) => (
          <span key={d.day} className={i % 2 === 0 ? '' : 'hide-sm'}>{d.day.slice(5)}</span>
        ))}
      </div>
      <div className="chart-legend-row">
        <span><i className="swatch sellers" /> Sellers</span>
        <span><i className="swatch customers" /> Customers</span>
        {hover !== null && (
          <span className="muted">{days[hover].day.slice(5)} · {days[hover].sellers + days[hover].customers} signups</span>
        )}
      </div>
    </div>
  );
}

/** Horizontal ranked bars (top stores). */
export function RankBars({ items }: { items: Array<{ name: string; value: number; sub?: string }> }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="rank-bars">
      {items.map((it, i) => (
        <li key={it.name}>
          <span className="rank-name" title={it.name}>{it.name}</span>
          <span className="rank-track">
            <i style={{ width: `${(it.value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
          </span>
          <span className="rank-val">{it.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
