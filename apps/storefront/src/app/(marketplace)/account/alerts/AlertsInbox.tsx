'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface AlertItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
  icon: string;
}

// Interactive inbox: opening an alert marks it read (POST /api/alerts) and
// "Mark all read" clears the badge. Rows link to the related order/thread/store.
export function AlertsInbox({ initial }: { initial: AlertItem[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);

  const unread = items.filter((i) => !i.read).length;

  async function markRead(ids: string[] | 'all') {
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids === 'all' ? { all: true } : { ids }),
      });
    } catch {
      // Best effort — the badge refreshes on next load anyway.
    }
  }

  function open(id: string, href: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    void markRead([id]);
    if (href) window.location.href = href;
  }

  async function markAll() {
    setBusy(true);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await markRead('all');
    setBusy(false);
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>No alerts yet.</p>
        <p className="muted" style={{ fontSize: 13.5 }}>
          Follow a store and you&apos;ll hear about new products and price drops here.
        </p>
        <div style={{ marginTop: 12 }}>
          <Link href="/discover" className="btn btn-outline btn-sm">Find stores to follow →</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {unread > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={markAll} disabled={busy}>
            {busy ? 'Marking…' : `Mark all ${unread} as read`}
          </button>
        </div>
      )}
      <div className="alerts-list" role="list">
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            role="listitem"
            className={`alert-row${a.read ? '' : ' is-unread'}`}
            onClick={() => open(a.id, a.href)}
          >
            <span className="alert-row-ico" aria-hidden>{a.icon}</span>
            <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
              <span className="alert-row-title">{a.title}</span>
              {a.body && <span className="alert-row-body">{a.body}</span>}
              <span className="alert-row-time muted">
                {new Date(a.createdAt).toLocaleString('en-NG', {
                  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </span>
            {!a.read && <span className="alert-row-dot" aria-label="unread" />}
          </button>
        ))}
      </div>
    </>
  );
}
