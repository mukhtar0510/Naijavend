'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatNaira } from '@idevtenancy/shared';

export interface CustomerRow {
  phone: string;
  name: string;
  orders: number;
  spentKobo: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

type Segment = 'all' | 'repeat' | 'new' | 'quiet';

const DAY = 24 * 60 * 60 * 1000;

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
}

/** 0803… → 234803…, which is what wa.me expects. */
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `234${digits.slice(1)}`;
  return digits;
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
  { id: 'quiet', label: 'Quiet', hint: 'No order for 60 days' },
];

function matches(c: CustomerRow, segment: Segment): boolean {
  if (segment === 'repeat') return c.orders >= 2;
  if (segment === 'new') return c.orders <= 1 && daysSince(c.firstOrderAt) <= 30;
  if (segment === 'quiet') return daysSince(c.lastOrderAt) > 60;
  return true;
}

export function CustomersClient({
  storeId,
  customers,
  initialNotes,
}: {
  storeId: string;
  customers: CustomerRow[];
  initialNotes: Record<string, string>;
}) {
  const [segment, setSegment] = useState<Segment>('all');
  const [query, setQuery] = useState('');
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'local'>('idle');
  const storageKey = `kv-crm-notes:${storeId}`;

  // Anything written while the notes table was unavailable lives here; surface
  // it once so the seller does not lose sight of a note they typed.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const local = JSON.parse(raw) as Record<string, string>;
      setNotes((prev) => ({ ...local, ...prev }));
    } catch {
      // Ignore malformed or blocked storage.
    }
  }, [storageKey]);

  async function saveNote(phone: string, value: string) {
    setNotes((prev) => {
      const next = { ...prev };
      if (value.trim()) next[phone] = value;
      else delete next[phone];
      return next;
    });
    setSaveState('saving');
    try {
      const res = await fetch('/api/dashboard/customer-notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, note: value }),
      });
      if (res.ok) {
        setSaveState('saved');
        // Keep the device copy in sync so a refresh is never blank offline.
        persistLocal(phone, value);
        return;
      }
      // 503 = notes table not migrated. Keep the note on this device.
      persistLocal(phone, value);
      setSaveState('local');
    } catch {
      persistLocal(phone, value);
      setSaveState('local');
    }
  }

  function persistLocal(phone: string, value: string) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const local = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      if (value.trim()) local[phone] = value;
      else delete local[phone];
      window.localStorage.setItem(storageKey, JSON.stringify(local));
    } catch {
      // Storage disabled — the in-memory note still shows for this visit.
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((c) => matches(c, segment))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) || c.phone.includes(q) : true));
  }, [customers, segment, query]);

  const repeatCount = customers.filter((c) => c.orders >= 2).length;

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <input
            type="search"
            className="input"
            placeholder="Search name or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search customers"
          />
        </div>
        <span className="badge" style={{ alignSelf: 'center' }}>
          {customers.length} customers · {repeatCount} repeat
        </span>
      </div>

      <div role="tablist" aria-label="Customer segment" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={segment === s.id}
            title={s.hint}
            onClick={() => setSegment(s.id)}
            className={`btn btn-sm ${segment === s.id ? 'btn-primary' : 'btn-outline'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 18 }}>
          {customers.length === 0
            ? 'No customers yet. Share your store link on WhatsApp to get your first order.'
            : 'No customer matches this filter.'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0', display: 'grid', gap: 10 }}>
          {visible.map((c) => {
            const open = openPhone === c.phone;
            return (
              <li key={c.phone} className="card">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 180px' }}>
                    <strong style={{ display: 'block' }}>{c.name}</strong>
                    <span className="muted mono" style={{ fontSize: 13 }}>{c.phone}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                    <span>
                      <strong>{c.orders}</strong> <span className="muted">order{c.orders === 1 ? '' : 's'}</span>
                    </span>
                    <span>
                      <strong>{formatNaira(c.spentKobo)}</strong> <span className="muted">spent</span>
                    </span>
                    <span className="muted">last {relative(c.lastOrderAt)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setOpenPhone(open ? null : c.phone)}
                      aria-expanded={open}
                    >
                      {notes[c.phone] ? 'Note •' : 'Add note'}
                    </button>
                    <a
                      className="btn btn-outline btn-sm"
                      href={`https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(
                        `Hello ${c.name.split(' ')[0]}, thank you for ordering from our store.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>

                {open && (
                  <div style={{ marginTop: 12 }}>
                    <label className="muted" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                      Private note (this browser only)
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      value={notes[c.phone] ?? ''}
                      placeholder="Prefers delivery after 5pm, buys in bulk before Eid…"
                      onChange={(e) => void saveNote(c.phone, e.target.value)}
                    />
                    {saveState !== 'idle' && (
                      <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
                        {saveState === 'saving'
                          ? 'Saving…'
                          : saveState === 'saved'
                            ? 'Saved to your store.'
                            : 'Saved on this device only — the notes table is not enabled yet.'}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
