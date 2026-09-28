'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function BookingPage() {
  const { slug, listingId } = useParams<{ slug: string; listingId: string }>();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [slot, setSlot] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'done'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setMessage('');
    try {
      const res = await fetch('/api/create-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, listingId, customerName: name, customerPhone: phone, slotStart: slot }),
      });
      const body = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(body?.error?.message ?? 'Could not create this booking.');
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
          <h1 style={{ color: 'var(--success)' }}>Booking requested</h1>
          <p className="muted">
            The seller will confirm your slot. You'll get a call or WhatsApp message on the number you provided.
          </p>
          <Link className="btn btn-outline" href={`/s/${slug}`}>Back to store</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-narrow" style={{ padding: '48px 20px' }}>
      <h1>Book an appointment</h1>
      <p className="muted">Pick a date and time. The seller confirms before it's final.</p>
      {message && <div className="alert alert-error">{message}</div>}
      <form onSubmit={submit} className="card">
        <div className="field">
          <label htmlFor="slot">Date &amp; time</label>
          <input
            id="slot"
            type="datetime-local"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            required
          />
          <p className="hint">Appointments run for one hour.</p>
        </div>
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2348012345678" required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Requesting…' : 'Request booking'}
        </button>
      </form>
    </main>
  );
}
