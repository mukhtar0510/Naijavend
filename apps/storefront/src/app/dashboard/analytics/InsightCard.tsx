'use client';

// Weekly insight card — fetches the plain-language summary in the background
// and degrades to the raw numbers if the model is unavailable or offline.
import { useEffect, useState } from 'react';
import { callApi } from '@/lib/api-client';
import type { InsightsPayload } from '@/app/api/ai/insights/route';

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; data: InsightsPayload }
  | { phase: 'unavailable' };

const naira = (kobo: number) => `₦${Math.round((kobo || 0) / 100).toLocaleString('en-NG')}`;

function NumbersGrid({ data }: { data: InsightsPayload }) {
  const n = data.numbers;
  if (!n) return null;
  const swap = (cur: number, prev: number) => {
    if (prev === 0 && cur === 0) return 'no activity yet';
    const delta = prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
    if (delta === null) return `${cur} (new)`;
    if (delta === 0) return `${cur} (same as last week)`;
    return `${cur} (${delta > 0 ? '+' : ''}${delta}% vs ${prev})`;
  };
  const rows: Array<[string, string]> = [
    ['Visits', swap(n.thisWeek.views, n.lastWeek.views)],
    ['Orders', swap(n.thisWeek.orders, n.lastWeek.orders)],
    ['Takings', `${naira(n.thisWeek.revenueKobo)} (${naira(n.lastWeek.revenueKobo)} last week)`],
  ];
  if (n.top) rows.push([n.top.title, `${n.top.units} sold (${n.top.prevUnits} last week)`]);

  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, margin: '12px 0 0' }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: '8px 10px' }}>
          <dt className="muted" style={{ fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</dt>
          <dd style={{ margin: '2px 0 0', fontSize: 14.5, fontWeight: 600 }}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InsightCard() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    callApi<InsightsPayload>('/api/ai/insights')
      .then((data) => {
        if (!cancelled) setState({ phase: 'ready', data });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase !== 'ready') {
    return (
      <section className="card" style={{ marginBottom: 20 }} aria-busy={state.phase === 'loading'}>
        <h2 style={{ fontSize: 18 }}>This week in your store</h2>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
          {state.phase === 'loading'
            ? 'Reading your last 14 days…'
            : 'The weekly summary is offline right now — the charts below are up to date.'}
        </p>
      </section>
    );
  }

  const { data } = state;
  return (
    <section className="card card-elevated" style={{ marginBottom: 20 }} aria-label="This week in your store">
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>This week in your store</h2>
        <span className="badge" style={{ fontSize: 11.5 }}>Compared with last week</span>
      </div>

      {data.summary && <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.55 }}>{data.summary}</p>}

      {data.points.length > 0 && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 14.5, lineHeight: 1.7 }}>
          {data.points.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      {data.action && (
        <p style={{ margin: '12px 0 0', fontSize: 14.5, background: 'var(--bg-subtle, #f5f7fb)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: '10px 12px' }}>
          <strong>Do this week:</strong> {data.action}
        </p>
      )}

      <NumbersGrid data={data} />
      <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
        {data.source === 'model'
          ? 'Written from your own analytics — the assistant never invents numbers beyond what is shown.'
          : 'Numbers from your dashboard above; the model-written summary needs a model key.'}
      </p>
    </section>
  );
}