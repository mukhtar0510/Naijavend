'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';

export interface TicketRow {
  id: string;
  subject: string;
  message: string;
  priority: boolean;
  status: 'open' | 'answered' | 'closed';
  reply: string;
  replied_at: string | null;
  created_at: string;
}

const STATUS = {
  open: { label: 'Waiting for Kwaravend', cls: 'badge badge-warning' },
  answered: { label: 'Answered', cls: 'badge badge-success' },
  closed: { label: 'Closed', cls: 'badge' },
} as const;

const fmt = (iso: string) => new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function SupportDesk({ initial }: { initial: TicketRow[] }) {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch('/api/dashboard/support', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject, message }) });
      const j = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message ?? 'Could not send.');
      setSubject('');
      setMessage('');
      setOk('Sent. We’ll reply here.');
      router.refresh();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function close(id: string) {
    await fetch('/api/dashboard/support', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'close', id }) });
    router.refresh();
  }

  return (
    <>
      <form className="card" onSubmit={send} style={{ display: 'grid', gap: 12, marginTop: 16 }} aria-label="Message Kwaravend">
        <label className="rr-field">
          <span>Subject</span>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required placeholder="e.g. My plan didn’t switch on" />
        </label>
        <label className="rr-field">
          <span>Message</span>
          <textarea className="input" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={5} required />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>
          <Send size={16} aria-hidden /> {busy ? 'Sending…' : 'Send to Kwaravend'}
        </button>
        {err && (
          <p role="alert" style={{ margin: 0, color: 'var(--danger)' }}>
            {err}
          </p>
        )}
        {ok && (
          <p role="status" className="muted" style={{ margin: 0 }}>
            {ok}
          </p>
        )}
      </form>

      <h2 style={{ fontSize: 17, marginTop: 24 }}>Your messages</h2>
      {initial.length === 0 ? (
        <div className="empty-state">No messages yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {initial.map((t) => (
            <li key={t.id} className="card" style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <strong>{t.subject}</strong>
                <span className={STATUS[t.status].cls}>{STATUS[t.status].label}</span>
                {t.priority && <span className="badge badge-gold">Priority</span>}
                <span className="muted" style={{ fontSize: 13 }}>{fmt(t.created_at)}</span>
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{t.message}</p>
              {t.reply && (
                <div style={{ borderLeft: '3px solid var(--gold)', paddingLeft: 12 }}>
                  <p className="muted" style={{ margin: '0 0 4px', fontSize: 12.5 }}>Kwaravend{t.replied_at ? ` · ${fmt(t.replied_at)}` : ''}</p>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{t.reply}</p>
                </div>
              )}
              {t.status !== 'closed' && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => close(t.id)} style={{ justifySelf: 'start' }}>
                  Mark as solved
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
