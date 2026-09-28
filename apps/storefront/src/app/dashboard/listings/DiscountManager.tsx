'use client';

import { useState } from 'react';

export interface DiscountRow {
  id: string;
  code: string;
  percent_off: number;
  active: boolean;
  usage_count: number;
  max_uses: number | null;
}

// Discount-code manager (Shopify-style promos): create, pause, delete —
// with live usage counts. Buyer side validates at order time.
export function DiscountManager({ initial }: { initial: DiscountRow[] }) {
  const [codes, setCodes] = useState<DiscountRow[]>(initial);
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, percentOff: Number(percent), maxUses: maxUses === '' ? null : Number(maxUses) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not create the code.');
      const fresh = await fetch('/api/discounts').then((r) => r.json());
      setCodes(fresh?.codes ?? []);
      setCode('');
      setPercent('');
      setMaxUses('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: DiscountRow) {
    setCodes((prev) => prev.map((c) => (c.id === row.id ? { ...c, active: !c.active } : c)));
    await fetch('/api/discounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, active: !row.active }),
    });
  }

  async function remove(row: DiscountRow) {
    setCodes((prev) => prev.filter((c) => c.id !== row.id));
    await fetch(`/api/discounts?id=${row.id}`, { method: 'DELETE' });
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Discount codes</h2>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Customers enter these at checkout. Percentage off, per store, with optional usage caps.
      </p>
      {error && <div className="alert alert-error">{error}</div>}

      {codes.length > 0 && (
        <div style={{ display: 'grid', gap: 8, margin: '14px 0 20px' }}>
          {codes.map((c) => (
            <div key={c.id} className="dash-listing-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="mono" style={{ fontWeight: 700 }}>{c.code}</span>
                <span className="badge badge-blue">{c.percent_off}% off</span>
                {!c.active && <span className="badge">Paused</span>}
                <span className="muted" style={{ fontSize: 13 }}>
                  {c.usage_count} used{c.max_uses != null ? ` / ${c.max_uses}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => toggle(c)}>
                  {c.active ? 'Pause' : 'Activate'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => remove(c)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={create} style={{ display: 'grid', gap: 10 }}>
        <div className="disc-grid">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="dcode">Code</label>
            <input id="dcode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" maxLength={40} required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="dpct">% off</label>
            <input id="dpct" type="number" min={1} max={90} value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="10" required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="dmax">Max uses</label>
            <input id="dmax" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="∞" />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create discount code'}
        </button>
      </form>
    </div>
  );
}
