'use client';

// Owner panels for the plan features (23 Nov 2026): Kwaravend rider requests,
// support tickets and custom domains. Data and writes go through /api/admin/ops.

import { useCallback, useEffect, useState } from 'react';

type Store = { name: string; slug: string; whatsapp_number?: string | null } | null;

function useArea<T>(area: string) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch(`/api/admin/ops?area=${area}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? 'Could not load.');
        setRows((j as { rows: T[] }).rows);
      })
      .catch((e: Error) => setErr(e.message));
  }, [area]);
  useEffect(load, [load]);
  async function save(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setErr(null);
    try {
      const r = await fetch('/api/admin/ops', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ area, id, ...body }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? 'Could not save.');
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return { rows, err, busy, save };
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/* ------------------------------------------------------------ riders */
interface RiderReq {
  id: string;
  speed: string;
  pickup: string;
  dropoff: string;
  note: string;
  status: string;
  rider_name: string | null;
  rider_phone: string | null;
  admin_note: string;
  created_at: string;
  stores: Store | Store[];
}
const SPEED: Record<string, string> = { standard: 'Standard', express: 'Express', same_day: 'Same-day' };
const NEXT: Record<string, Array<{ to: string; label: string }>> = {
  requested: [{ to: 'assigned', label: 'Assign rider' }],
  assigned: [{ to: 'picked_up', label: 'Picked up' }],
  picked_up: [{ to: 'delivered', label: 'Delivered' }],
};

function RiderRow({ r, busy, save }: { r: RiderReq; busy: boolean; save: (id: string, body: Record<string, unknown>) => void }) {
  const [name, setName] = useState(r.rider_name ?? '');
  const [phone, setPhone] = useState(r.rider_phone ?? '');
  const [note, setNote] = useState(r.admin_note ?? '');
  const st = one(r.stores);
  const open = !['delivered', 'cancelled'].includes(r.status);
  return (
    <li className="card">
      <div className="admin-report-head">
        <strong>{st?.name ?? 'Deleted store'}</strong>
        <span className={r.speed === 'standard' ? 'badge' : 'badge badge-gold'}>{SPEED[r.speed] ?? r.speed}</span>
        <span className={r.status === 'requested' ? 'badge badge-warning' : r.status === 'delivered' ? 'badge badge-success' : 'badge'}>{r.status.replace('_', ' ')}</span>
        <span className="muted">{fmt(r.created_at)}</span>
      </div>
      <p>
        <strong>From</strong> {r.pickup} <strong>to</strong> {r.dropoff}
        {r.note && <span className="muted"> · {r.note}</span>}
        {st?.whatsapp_number && <span className="muted"> · seller {st.whatsapp_number}</span>}
      </p>
      {open && (
        <div className="admin-bank-form">
          <label>
            Rider name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Rider phone
            <input className="input mono" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </label>
          <label>
            Note to seller
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      )}
      {open && (
        <div className="admin-report-actions">
          {(NEXT[r.status] ?? []).map((n) => (
            <button key={n.to} type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => save(r.id, { status: n.to, riderName: name, riderPhone: phone, adminNote: note })}>
              {n.label}
            </button>
          ))}
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => save(r.id, { status: r.status, riderName: name, riderPhone: phone, adminNote: note })}>
            Save details
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => window.confirm('Cancel this request?') && save(r.id, { status: 'cancelled', adminNote: note })}>
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}

export function AdminRiderRequests() {
  const { rows, err, busy, save } = useArea<RiderReq>('riders');
  if (!rows && !err) return <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />;
  const open = (rows ?? []).filter((r) => !['delivered', 'cancelled'].includes(r.status));
  const done = (rows ?? []).filter((r) => ['delivered', 'cancelled'].includes(r.status)).slice(0, 20);
  return (
    <section className="admin-panel" aria-label="Kwaravend riders">
      {err && <div className="alert alert-error">{err}</div>}
      <p className="muted">Sellers with the rider add-on request a Kwaravend rider here. Assign one with a name and phone; the seller sees it at once.</p>
      <h3>Open ({open.length})</h3>
      {open.length === 0 ? <div className="empty-state">No open requests.</div> : <ul className="admin-reports">{open.map((r) => <RiderRow key={r.id} r={r} busy={busy === r.id} save={save} />)}</ul>}
      {done.length > 0 && (
        <>
          <h3>Recent</h3>
          <ul className="admin-reports">{done.map((r) => <RiderRow key={r.id} r={r} busy={busy === r.id} save={save} />)}</ul>
        </>
      )}
    </section>
  );
}

/* ----------------------------------------------------------- support */
interface Ticket {
  id: string;
  subject: string;
  message: string;
  priority: boolean;
  status: 'open' | 'answered' | 'closed';
  reply: string;
  replied_at: string | null;
  created_at: string;
  stores: Store | Store[];
}

function TicketRow({ t, busy, save }: { t: Ticket; busy: boolean; save: (id: string, body: Record<string, unknown>) => void }) {
  const [reply, setReply] = useState(t.reply ?? '');
  const st = one(t.stores);
  return (
    <li className="card">
      <div className="admin-report-head">
        <strong>{t.subject}</strong>
        {t.priority && <span className="badge badge-gold">Priority · Emirates Plus</span>}
        <span className={t.status === 'open' ? 'badge badge-warning' : t.status === 'answered' ? 'badge badge-success' : 'badge'}>{t.status}</span>
        <span className="muted">
          {st?.name ?? 'Deleted store'} · {fmt(t.created_at)}
        </span>
      </div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{t.message}</p>
      {t.status !== 'closed' && (
        <textarea className="input" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the seller" style={{ width: '100%' }} />
      )}
      {t.status !== 'closed' && (
        <div className="admin-report-actions">
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !reply.trim()} onClick={() => save(t.id, { reply })}>
            Send reply
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save(t.id, { status: 'closed' })}>
            Close
          </button>
        </div>
      )}
      {t.status === 'closed' && t.reply && <p className="muted">Reply: {t.reply}</p>}
    </li>
  );
}

export function AdminSupport() {
  const { rows, err, busy, save } = useArea<Ticket>('support');
  if (!rows && !err) return <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />;
  const open = (rows ?? []).filter((t) => t.status === 'open').sort((a, b) => Number(b.priority) - Number(a.priority));
  const rest = (rows ?? []).filter((t) => t.status !== 'open').slice(0, 30);
  return (
    <section className="admin-panel" aria-label="Support">
      {err && <div className="alert alert-error">{err}</div>}
      <p className="muted">Seller messages from Dashboard → Support. Emirates Plus tickets are priority and sit at the top.</p>
      <h3>Waiting for a reply ({open.length})</h3>
      {open.length === 0 ? <div className="empty-state">Nothing waiting.</div> : <ul className="admin-reports">{open.map((t) => <TicketRow key={t.id} t={t} busy={busy === t.id} save={save} />)}</ul>}
      {rest.length > 0 && (
        <>
          <h3>Answered and closed</h3>
          <ul className="admin-reports">{rest.map((t) => <TicketRow key={t.id} t={t} busy={busy === t.id} save={save} />)}</ul>
        </>
      )}
    </section>
  );
}

/* ----------------------------------------------------------- domains */
interface DomainRow {
  id: string;
  domain: string;
  status: 'pending' | 'active' | 'failed';
  note: string;
  created_at: string;
  stores: Store | Store[];
}

function DomainItem({ d, busy, save }: { d: DomainRow; busy: boolean; save: (id: string, body: Record<string, unknown>) => void }) {
  const [note, setNote] = useState(d.note ?? '');
  const st = one(d.stores);
  return (
    <li className="card">
      <div className="admin-report-head">
        <strong className="mono">{d.domain}</strong>
        <span className={d.status === 'active' ? 'badge badge-success' : d.status === 'failed' ? 'badge badge-danger' : 'badge badge-warning'}>{d.status}</span>
        <span className="muted">
          {st?.name ?? 'Deleted store'} · {fmt(d.created_at)}
        </span>
      </div>
      <p className="muted">
        1. In Vercel → project → Domains, add <span className="mono">{d.domain}</span>. 2. When Vercel shows it valid, press Switch on.
      </p>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the seller (optional)" />
      <div className="admin-report-actions">
        {d.status !== 'active' && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => save(d.id, { status: 'active', note })}>
            Switch on
          </button>
        )}
        {d.status !== 'failed' && (
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => save(d.id, { status: 'failed', note: note || 'The DNS record isn’t pointing at Kwaravend yet.' })}>
            Needs DNS fix
          </button>
        )}
        {d.status === 'active' && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save(d.id, { status: 'pending', note })}>
            Switch off
          </button>
        )}
      </div>
    </li>
  );
}

export function AdminDomains() {
  const { rows, err, busy, save } = useArea<DomainRow>('domains');
  if (!rows && !err) return <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />;
  return (
    <section className="admin-panel" aria-label="Domains">
      {err && <div className="alert alert-error">{err}</div>}
      <p className="muted">Emirates Plus stores on their own domain. A domain only serves the store once it is added in Vercel and switched on here.</p>
      {(rows ?? []).length === 0 ? <div className="empty-state">No domains yet.</div> : <ul className="admin-reports">{(rows ?? []).map((d) => <DomainItem key={d.id} d={d} busy={busy === d.id} save={save} />)}</ul>}
    </section>
  );
}
