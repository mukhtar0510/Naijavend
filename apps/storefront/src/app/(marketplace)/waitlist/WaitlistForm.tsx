'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { STORE_CATEGORIES, categoryLabel } from '@idevtenancy/shared';

export function WaitlistForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, phone, city, category, website }),
      });
      const j = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message ?? 'Could not join. Try again.');
      setDone(true);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 18 }} role="status">
        <CheckCircle2 size={22} aria-hidden style={{ color: 'var(--green)' }} />
        <span>You&apos;re on the list. We&apos;ll call {phone} when we open in {city}.</span>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit} style={{ display: 'grid', gap: 12, padding: 18 }}>
      <label style={{ display: 'grid', gap: 4, fontWeight: 600, fontSize: 14 }}>
        Your name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} />
      </label>
      <label style={{ display: 'grid', gap: 4, fontWeight: 600, fontSize: 14 }}>
        Phone (WhatsApp if you have it)
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="08012345678" required />
      </label>
      <label style={{ display: 'grid', gap: 4, fontWeight: 600, fontSize: 14 }}>
        City or town
        <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Offa, Osogbo, Abuja" required />
      </label>
      <label style={{ display: 'grid', gap: 4, fontWeight: 600, fontSize: 14 }}>
        What do you sell? (optional)
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Choose</option>
          {STORE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden style={{ position: 'absolute', left: '-9999px' }} />
      {err && (
        <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 13.5 }}>
          {err}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Joining…' : 'Join the waitlist'}
      </button>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>We only use your number to tell you when we open in your city.</p>
    </form>
  );
}
