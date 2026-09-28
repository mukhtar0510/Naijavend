'use client';

// Pure-CSS charts (no chart library) for the analytics dashboard.
export function DailyChart({ data }: { data: Array<{ label: string; visits: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.visits));
  return (
    <div>
      <div className="spark-bars" role="img" aria-label="Daily visits for the last 14 days">
        {data.map((d) => (
          <div
            key={d.label}
            className={`spark-bar${d.visits === 0 ? ' dim' : ''}`}
            style={{ height: `${Math.max(3, (d.visits / max) * 100)}%` }}
            title={`${d.label}: ${d.visits} visit${d.visits === 1 ? '' : 's'}`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {data.map((d, i) => (
          <span
            key={d.label}
            className="muted"
            style={{ flex: 1, fontSize: 9.5, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}
          >
            {i % 2 === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TopReferrers({ data, total }: { data: Array<{ label: string; count: number }>; total: number }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      {data.map((d) => (
        <div key={d.label} className="source-row">
          <span style={{ minWidth: 140 }}>{d.label}</span>
          <div className="source-bar-track">
            <div className="source-bar-fill" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="muted mono" style={{ fontSize: 12.5, minWidth: 64, textAlign: 'right' }}>
            {d.count} · {Math.round((d.count / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
