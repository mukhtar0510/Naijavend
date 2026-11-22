'use client';

// Owner-only admin panels added for BUILD.md T10 (growth), T13 (moderation,
// blue tick) and T03 (feature flags). Each loads its own data.

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, Eye, ShieldOff } from 'lucide-react';
import { formatNaira } from '@idevtenancy/shared';
import { FEATURES, FLAG_ENV, type FeatureKey } from '@/lib/flags';

/* ------------------------------------------------------------------ growth */
interface Growth {
  eventsReady: boolean;
  deliveriesReady: boolean;
  stores: { total: number; new7: number; published: number; setupDone: number; setupRate: number; weeklyActive: number; withOrder: number; retention30: number | null; cohortSize: number };
  orders30: { count: number; valueKobo: number; paidCount: number; paidKobo: number };
  deliveries30: { total: number; delivered: number; firstTryRate: number | null };
  areas: Array<{ area: string; count: number }>;
  plans: Array<{ plan: string; count: number }>;
  events30: Record<string, number>;
}

function Tile({ label, value, hint, target }: { label: string; value: React.ReactNode; hint?: string; target?: string }) {
  return (
    <div className="admin-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {(hint || target) && (
        <em>
          {hint}
          {target ? `${hint ? ' · ' : ''}target ${target}` : ''}
        </em>
      )}
    </div>
  );
}

export function AdminGrowth() {
  const [g, setG] = useState<Growth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/admin/growth')
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? 'Could not load.');
        setG(j as Growth);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);
  if (err) return <div className="alert alert-error">{err}</div>;
  if (!g) return <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />;
  const s = g.stores;
  return (
    <section className="admin-panel" aria-label="Growth">
      {!g.eventsReady && <div className="alert">Weekly-active and event counts need the events database update.</div>}
      <h3>Stores (real stores only, examples excluded)</h3>
      <div className="admin-tiles">
        <Tile label="Stores" value={s.total} hint={`${s.new7} new this week`} />
        <Tile label="Published" value={s.published} hint="3+ products" />
        <Tile label="Weekly active" value={g.eventsReady ? s.weeklyActive : '—'} hint={s.total ? `${Math.round((s.weeklyActive / s.total) * 100)}% of stores` : undefined} target="60%" />
        <Tile label="Setup complete" value={`${s.setupRate}%`} hint={`${s.setupDone} stores`} target="70%" />
        <Tile label="With an order" value={s.withOrder} hint="last 60 days" />
        <Tile label="30-day retention" value={s.retention30 == null ? '—' : `${s.retention30}%`} hint={s.cohortSize ? `of ${s.cohortSize} stores opened 30–60 days ago` : 'no cohort yet'} target="50%" />
      </div>
      <h3>Orders, last 30 days</h3>
      <div className="admin-tiles">
        <Tile label="Orders" value={g.orders30.count} hint={formatNaira(g.orders30.valueKobo)} />
        <Tile label="Paid (confirmed)" value={g.orders30.paidCount} hint={formatNaira(g.orders30.paidKobo)} />
        <Tile label="Deliveries" value={g.deliveriesReady ? `${g.deliveries30.delivered} / ${g.deliveries30.total}` : '—'} hint="delivered / created" />
        <Tile label="Delivered first try" value={g.deliveries30.firstTryRate == null ? '—' : `${g.deliveries30.firstTryRate}%`} />
      </div>
      <div className="admin-two">
        <div>
          <h3>Stores by Ilorin area</h3>
          <ul className="admin-list">
            {g.areas.map((a) => (
              <li key={a.area}>
                <span>{a.area}</span>
                <strong>{a.count}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Stores by plan</h3>
          <ul className="admin-list">
            {g.plans.map((p) => (
              <li key={p.plan}>
                <span style={{ textTransform: 'capitalize' }}>{p.plan}</span>
                <strong>{p.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {g.eventsReady && Object.keys(g.events30).length > 0 && (
        <>
          <h3>Events, last 30 days</h3>
          <ul className="admin-list is-cols">
            {Object.entries(g.events30)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <li key={k}>
                  <span className="mono">{k}</span>
                  <strong>{v}</strong>
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- moderation */
interface Report {
  id: string;
  reason: string;
  message: string;
  status: string;
  created_at: string;
  stores: { id: string; name: string; slug: string; verification_status: string | null } | null;
}
const REASON: Record<string, string> = {
  scam: 'Scam',
  fake_goods: 'Fake goods',
  no_response: 'Never responds',
  wrong_product: 'Wrong product',
  abuse: 'Abuse',
  other: 'Other',
};

export function AdminModeration() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch('/api/admin/moderation')
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? 'Could not load.');
        setReports((j as { reports: Report[] }).reports);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setErr(null);
    try {
      const r = await fetch('/api/admin/moderation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? 'Could not save.');
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!reports && !err) return <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />;
  return (
    <section className="admin-panel" aria-label="Moderation">
      {err && <div className="alert alert-error">{err}</div>}
      <p className="muted">
        Reports buyers sent from store pages. Revoking a blue tick is logged in the audit log; the store keeps working.
      </p>
      {reports && reports.length === 0 ? (
        <div className="empty-state">No open reports.</div>
      ) : (
        <ul className="admin-reports">
          {(reports ?? []).map((r) => {
            const verified = r.stores?.verification_status === 'verified';
            return (
              <li key={r.id} className="card">
                <div className="admin-report-head">
                  <strong>{r.stores?.name ?? 'Deleted store'}</strong>
                  <span className="badge badge-danger">{REASON[r.reason] ?? r.reason}</span>
                  <span className={r.status === 'open' ? 'badge badge-warning' : 'badge'}>{r.status === 'open' ? 'New' : 'Reviewing'}</span>
                  <span className="muted">{new Date(r.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                </div>
                {r.message && <p>&ldquo;{r.message}&rdquo;</p>}
                <div className="admin-report-actions">
                  {r.stores?.slug && (
                    <a className="btn btn-outline btn-sm" href={`/s/${r.stores.slug}`} target="_blank" rel="noopener noreferrer">
                      <Eye size={14} aria-hidden /> Open store
                    </a>
                  )}
                  {r.status === 'open' && (
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy === r.id} onClick={() => act(r.id, { reportId: r.id, status: 'reviewing' })}>
                      Mark reviewing
                    </button>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" disabled={busy === r.id} onClick={() => act(r.id, { reportId: r.id, status: 'closed' })}>
                    <CheckCircle2 size={14} aria-hidden /> Close
                  </button>
                  {r.stores && (
                    <button
                      type="button"
                      className={verified ? 'btn btn-danger btn-sm' : 'btn btn-outline btn-sm'}
                      disabled={busy === r.stores.id}
                      onClick={() => {
                        if (verified && !window.confirm(`Revoke the blue tick from ${r.stores!.name}?`)) return;
                        void act(r.stores!.id, { storeId: r.stores!.id, verified: !verified, note: `From report ${r.id}` });
                      }}
                    >
                      {verified ? (
                        <>
                          <ShieldOff size={14} aria-hidden /> Revoke blue tick
                        </>
                      ) : (
                        <>
                          <BadgeCheck size={14} aria-hidden /> Grant blue tick
                        </>
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- flags */
const FLAG_NOTES: Record<FeatureKey, string> = {
  dropshipperMode: 'Dropshipper workflow (supplier copy, badges, shipping windows).',
  rankings: 'Public rankings page and ranking chips.',
  multiBranchTools: 'Branch management and per-branch hours.',
  storefrontCustomisation: 'Heavy store customisation (layouts, section colours, fonts).',
  exampleStores: 'Labelled example stores in lists and on the map (they never take orders).',
  planGating: 'Lock CRM, dispatch and reports to paid plans. Plans are on sale: turn on so paid features need an active plan.',
};

export function AdminFlags() {
  return (
    <section className="admin-panel" aria-label="Feature flags">
      <p className="muted">
        Flags are set as environment variables in Vercel (value <span className="mono">on</span> or <span className="mono">off</span>), then
        redeploy. This panel shows what the current deploy is using.
      </p>
      <ul className="admin-flags">
        {(Object.keys(FEATURES) as FeatureKey[]).map((k) => (
          <li key={k} className="card">
            <div>
              <strong>{k}</strong>
              <p>{FLAG_NOTES[k]}</p>
              <span className="mono">{FLAG_ENV[k]}</span>
            </div>
            <span className={FEATURES[k] ? 'badge badge-success' : 'badge'}>{FEATURES[k] ? 'On' : 'Off'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
