'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function RatePage() {
  const { slug } = useParams<{ slug: string }>();
  const [stars, setStars] = useState(0);
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'done'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (stars < 1) {
      setMessage('Tap the stars to choose a rating.');
      return;
    }
    setStatus('submitting');
    setMessage('');
    try {
      const res = await fetch('/api/submit-rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, stars, customerPhone: phone, reference: reference.trim(), comment }),
      });
      const body = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(body?.error?.message ?? 'Could not submit your review.');
        return;
      }
      setStatus('done');
    } catch {
      setStatus('error');
      setMessage('Network problem — check your connection and try again.');
    }
  }

  if (status === 'done') {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <div className="card card-elevated" style={{ textAlign: 'center' }}>
          <h1 style={{ color: 'var(--success)' }}>Review submitted</h1>
          <p className="muted">Thanks — your rating now counts toward this store's ranking.</p>
          <Link className="btn btn-outline" href={`/s/${slug}`}>Back to store</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-narrow" style={{ padding: '48px 20px' }}>
      <h1>Rate this store</h1>
      <p className="muted">
        Your phone number is used once to verify you're a real customer — it's never shown publicly, and you
        can review anonymously afterwards.
      </p>
      {message && <div className="alert alert-error">{message}</div>}
      <form onSubmit={submit} className="card">
        <div className="field">
          <label>Rating</label>
          <div role="radiogroup" aria-label="Star rating" style={{ fontSize: 32, display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                onClick={() => setStars(n)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 32,
                  color: n <= stars ? 'var(--amber)' : 'var(--border)',
                  padding: 0,
                }}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="phone">Phone number used for your order or booking</label>
          <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2348012345678" required />
          <p className="hint">Verifies you actually transacted with this store.</p>
        </div>
        <div className="field">
          <label htmlFor="ref">Order reference (optional)</label>
          <input id="ref" type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="mono" placeholder="e.g. MOCK-XYZ-1234" />
        </div>
        <div className="field">
          <label htmlFor="comment">Your review (optional)</label>
          <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="What stood out — good or bad?" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Submitting…' : 'Submit review'}
        </button>
      </form>
    </main>
  );
}
