'use client';

// Seller CRM (BUILD.md T12, REDESIGN T12): search, segments, repeat badges, a
// side drawer with order history and a private note, one-tap WhatsApp, and
// exports (CSV, or copy numbers for a WhatsApp broadcast list). Messages are
// pre-filled links only; nothing is sent automatically.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, Download, MessageCircle, Phone, Repeat, Search, StickyNote, X } from 'lucide-react';
import { formatNaira } from '@idevtenancy/shared';
import { SPRING, T } from '@/lib/motion';

export interface CustomerRow {
  phone: string;
  name: string;
  orders: number;
  spentKobo: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

export interface CustomerOrder {
  ref: string;
  at: string;
  totalKobo: number;
  status: string;
  paid: boolean;
  items: string;
}

type Segment = 'all' | 'repeat' | 'new' | 'quiet';

const DAY = 24 * 60 * 60 * 1000;
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);

/** 0803… → 234803…, which is what wa.me expects. */
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
}

function relative(iso: string): string {
  const d = daysSince(iso);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  const months = Math.floor(d / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

const SEGMENTS: Array<{ id: Segment; label: string; hint: string }> = [
  { id: 'all', label: 'Everyone', hint: 'Every buyer with an order' },
  { id: 'repeat', label: 'Repeat', hint: 'Two orders or more' },
  { id: 'new', label: 'New', hint: 'First order in the last 30 days' },
  { id: 'quiet', label: 'Quiet', hint: 'No order for 60 days: a good time to say hello' },
];

function matches(c: CustomerRow, segment: Segment): boolean {
  if (segment === 'repeat') return c.orders >= 2;
  if (segment === 'new') return c.orders <= 1 && daysSince(c.firstOrderAt) <= 30;
  if (segment === 'quiet') return daysSince(c.lastOrderAt) > 60;
  return true;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  fulfilled: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export function CustomersClient({
  storeId,
  customers,
  initialNotes,
  history,
  notesInStore,
}: {
  storeId: string;
  customers: CustomerRow[];
  initialNotes: Record<string, string>;
  history: Record<string, CustomerOrder[]>;
  notesInStore: boolean;
}) {
  const [segment, setSegment] = useState<Segment>('all');
  const [query, setQuery] = useState('');
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes);
  const [copied, setCopied] = useState(false);
  const storageKey = `kv-crm-notes:${storeId}`;

  // Notes typed while the table was unavailable live on this device.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const local = JSON.parse(raw) as Record<string, string>;
      setNotes((prev) => ({ ...local, ...prev }));
    } catch {
      /* malformed or blocked storage */
    }
  }, [storageKey]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((c) => matches(c, segment))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) || c.phone.includes(q) : true));
  }, [customers, segment, query]);

  const counts = useMemo(
    () => Object.fromEntries(SEGMENTS.map((s) => [s.id, customers.filter((c) => matches(c, s.id)).length])) as Record<Segment, number>,
    [customers],
  );
  const repeatRate = customers.length ? Math.round((counts.repeat / customers.length) * 100) : 0;
  const totalOrders = customers.reduce((a, c) => a + c.orders, 0);
  const aov = totalOrders ? Math.round(customers.reduce((a, c) => a + c.spentKobo, 0) / totalOrders) : 0;
  const open = customers.find((c) => c.phone === openPhone) ?? null;

  function exportCsv() {
    const rows = [['Name', 'Phone', 'Orders', 'Spent (NGN)', 'First order', 'Last order', 'Note']];
    for (const c of visible) {
      rows.push([c.name, c.phone, String(c.orders), String(Math.round(c.spentKobo / 100)), c.firstOrderAt.slice(0, 10), c.lastOrderAt.slice(0, 10), notes[c.phone] ?? '']);
    }
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${segment}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyNumbers() {
    try {
      await navigator.clipboard.writeText(visible.map((c) => `+${waNumber(c.phone)}`).join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <>
      <div className="crm-kpis">
        <div>
          <span>Customers</span>
          <strong>{customers.length}</strong>
        </div>
        <div>
          <span>Repeat buyers</span>
          <strong>{repeatRate}%</strong>
        </div>
        <div>
          <span>Average order</span>
          <strong className="mono">{formatNaira(aov)}</strong>
        </div>
      </div>

      <div className="crm-bar">
        <label className="crm-search">
          <Search size={16} aria-hidden />
          <input type="search" placeholder="Search name or phone" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search customers" />
        </label>
        <button type="button" className="btn btn-outline btn-sm" onClick={copyNumbers} disabled={!visible.length} title="For a WhatsApp broadcast list">
          <Copy size={14} aria-hidden /> {copied ? 'Copied' : `Copy ${visible.length} numbers`}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv} disabled={!visible.length}>
          <Download size={14} aria-hidden /> CSV
        </button>
      </div>

      <div className="crm-segs" role="tablist" aria-label="Customer segment">
        {SEGMENTS.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={segment === s.id} title={s.hint} onClick={() => setSegment(s.id)} className={segment === s.id ? 'chip is-active' : 'chip'}>
            {s.label} <span className="chip-count">{counts[s.id]}</span>
          </button>
        ))}
      </div>
      {segment === 'quiet' && counts.quiet > 0 && <p className="crm-hint">These buyers haven&apos;t ordered in 2 months. A friendly message with something new often brings them back.</p>}

      {visible.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 18 }}>
          {customers.length === 0 ? 'No customers yet. Share your store link on WhatsApp to get your first order.' : 'No customer matches this filter.'}
        </div>
      ) : (
        <ul className="crm-list">
          {visible.map((c) => (
            <li key={c.phone}>
              <button type="button" className="crm-row" onClick={() => setOpenPhone(c.phone)} aria-haspopup="dialog">
                <span className="crm-avatar" aria-hidden>
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <span className="crm-main">
                  <strong>
                    {c.name}
                    {c.orders >= 2 && (
                      <span className="crm-repeat">
                        <Repeat size={11} aria-hidden /> Repeat
                      </span>
                    )}
                    {notes[c.phone] && <StickyNote size={13} aria-label="Has a note" className="crm-noteico" />}
                  </strong>
                  <span className="mono">{c.phone}</span>
                </span>
                <span className="crm-stats">
                  <span>
                    <strong>{c.orders}</strong> order{c.orders === 1 ? '' : 's'}
                  </span>
                  <span className="mono">{formatNaira(c.spentKobo)}</span>
                  <span className="muted">last {relative(c.lastOrderAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {open && (
          <CustomerDrawer
            key={open.phone}
            c={open}
            orders={history[open.phone] ?? []}
            note={notes[open.phone] ?? ''}
            notesInStore={notesInStore}
            storageKey={storageKey}
            onNote={(v) => setNotes((prev) => ({ ...prev, [open.phone]: v }))}
            onClose={() => setOpenPhone(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function CustomerDrawer({
  c,
  orders,
  note,
  notesInStore,
  storageKey,
  onNote,
  onClose,
}: {
  c: CustomerRow;
  orders: CustomerOrder[];
  note: string;
  notesInStore: boolean;
  storageKey: string;
  onNote: (v: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(note);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'local'>('idle');
  const timer = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const first = c.name.split(' ')[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function persistLocal(value: string) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const local = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      if (value.trim()) local[c.phone] = value;
      else delete local[c.phone];
      window.localStorage.setItem(storageKey, JSON.stringify(local));
    } catch {
      /* storage off */
    }
  }

  async function save(value: string) {
    onNote(value);
    setState('saving');
    try {
      const res = await fetch('/api/dashboard/customer-notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: c.phone, note: value }),
      });
      persistLocal(value);
      setState(res.ok ? 'saved' : 'local');
    } catch {
      persistLocal(value);
      setState('local');
    }
  }

  // Save after a short pause (and on blur), not on every key.
  function change(v: string) {
    setDraft(v);
    setState('idle');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(v), 900);
  }

  const wa = (text: string) => `https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(text)}`;

  return (
    <motion.div className="crm-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T.base} onClick={onClose}>
      <motion.div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={c.name}
        className="crm-drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={SPRING.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="crm-dhead">
          <span className="crm-avatar is-lg" aria-hidden>
            {c.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h2>{c.name}</h2>
            <span className="mono">{c.phone}</span>
          </div>
          <button type="button" className="crm-x" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="crm-dstats">
          <div>
            <span>Orders</span>
            <strong>{c.orders}</strong>
          </div>
          <div>
            <span>Spent</span>
            <strong className="mono">{formatNaira(c.spentKobo)}</strong>
          </div>
          <div>
            <span>Customer since</span>
            <strong>{new Date(c.firstOrderAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}</strong>
          </div>
        </div>

        <div className="crm-dactions">
          <a className="btn btn-whatsapp btn-sm" href={wa(`Hello ${first}, thank you for ordering from us.`)} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} aria-hidden /> Say thanks
          </a>
          <a className="btn btn-outline btn-sm" href={wa(`Hello ${first}, we have something new you might like.`)} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} aria-hidden /> Share something new
          </a>
          <a className="btn btn-outline btn-sm" href={`tel:${c.phone}`}>
            <Phone size={14} aria-hidden /> Call
          </a>
        </div>

        <section className="crm-dsec">
          <h3>Private note</h3>
          <textarea
            className="input"
            rows={3}
            value={draft}
            placeholder="Prefers delivery after 5pm, buys in bulk before Eid…"
            onChange={(e) => change(e.target.value)}
            onBlur={() => {
              if (timer.current) window.clearTimeout(timer.current);
              if (draft !== note) void save(draft);
            }}
            maxLength={500}
          />
          <p className="crm-hint">
            {state === 'saving'
              ? 'Saving…'
              : state === 'saved'
                ? 'Saved to your store. Only you can see it.'
                : state === 'local'
                  ? 'Saved on this device only (the notes table isn’t available).'
                  : notesInStore
                    ? 'Only you can see this note.'
                    : 'Notes save on this device until the notes update is applied.'}
          </p>
        </section>

        <section className="crm-dsec">
          <h3>Orders</h3>
          {orders.length === 0 ? (
            <p className="crm-hint">No orders to show.</p>
          ) : (
            <ul className="crm-orders">
              {orders.map((o) => (
                <li key={o.ref}>
                  <div>
                    <strong className="mono">{o.ref}</strong>
                    <span className="muted"> · {new Date(o.at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  {o.items && <p>{o.items}</p>}
                  <div className="crm-ometa">
                    <span className="mono">{formatNaira(o.totalKobo)}</span>
                    <span className={o.paid ? 'badge badge-success' : 'badge'}>{o.paid ? 'Paid' : (STATUS_LABEL[o.status] ?? o.status)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </motion.div>
    </motion.div>
  );
}
