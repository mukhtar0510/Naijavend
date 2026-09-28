'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_CHARS = 140;

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Announcement editor: text with live ribbon preview + character counter, and
// an optional schedule (starts/ends). Empty schedule = always visible.
export function AnnouncementCard({
  initial,
  startsAt,
  endsAt,
}: {
  initial: string;
  startsAt: string | null;
  endsAt: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [start, setStart] = useState(toLocalInput(startsAt));
  const [end, setEnd] = useState(toLocalInput(endsAt));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const over = text.length > MAX_CHARS;
  const timeValid = !start || !end || new Date(start) <= new Date(end);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcement: text,
          announcement_starts_at: start ? new Date(start).toISOString() : null,
          announcement_ends_at: end ? new Date(end).toISOString() : null,
        }),
      });
      const body = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(body.error?.message ?? 'Save failed');
      setMsg({ ok: true, text: 'Announcement saved — your store site is updated.' });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-elevated" style={{ marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>📢 Announcement banner</h2>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: 13.5 }}>
        A banner on your store site for promos and updates. Leave the schedule empty to always show it.
      </p>

      <div className="field">
        <label htmlFor="announcement-text">Message ({text.length}/{MAX_CHARS})</label>
        <textarea
          id="announcement-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_CHARS + 20}
          rows={2}
          placeholder="e.g. 20% off all braids this week — walk-ins welcome!"
          style={{ resize: 'vertical' }}
        />
        {over && <p className="field-error">Keep it to {MAX_CHARS} characters.</p>}
      </div>

      <div className="field">
        <label>Live preview</label>
        <div className="store-ribbon" style={{ margin: 0 }}>
          <span className="store-ribbon-tag" aria-hidden>📢</span>
          <p style={{ opacity: text.trim() ? 1 : 0.5 }}>{text.trim() || 'Your announcement will appear like this…'}</p>
        </div>
      </div>

      <div className="announce-dates">
        <div className="field">
          <label htmlFor="ann-start">Starts (optional)</label>
          <input id="ann-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ann-end">Ends (optional)</label>
          <input id="ann-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {!timeValid && <p className="field-error">The end time must be after the start time.</p>}

      {start && (
        <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
          Shows from {new Date(start).toLocaleString()} {end ? `until ${new Date(end).toLocaleString()}` : 'with no end date'}
          {end ? '' : ' — set an end time so expired promos disappear automatically.'}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={save}
          disabled={busy || over || !timeValid || (text.length === 0 && initial.length === 0)}
        >
          {busy ? 'Saving…' : 'Save announcement'}
        </button>
        {text.length === 0 && initial.length > 0 && (
          <span className="muted" style={{ fontSize: 12.5 }}>Saving an empty message removes the banner.</span>
        )}
      </div>
      {msg && <p className={msg.ok ? 'alert alert-success' : 'alert alert-error'} style={{ marginTop: 10, marginBottom: 0 }}>{msg.text}</p>}
    </div>
  );
}
