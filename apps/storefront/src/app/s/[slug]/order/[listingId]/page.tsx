'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type PromoState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'valid'; percentOff: number }
  | { kind: 'invalid'; message: string };

export default function OrderPage() {
  const { slug, listingId } = useParams<{ slug: string; listingId: string }>();
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [promo, setPromo] = useState('');
  const [promoState, setPromoState] = useState<PromoState>({ kind: 'idle' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [payToken, setPayToken] = useState<string | null>(null);

  // Live promo check: debounced; only fires with 4+ characters so we don't
  // hammer the API on every keystroke of "WELCOME10".
  function onPromoChange(v: string) {
    const code = v.toUpperCase();
    setPromo(code);
    setPromoState({ kind: 'idle' });
    if (code.trim().length < 4) return;
    setPromoState({ kind: 'checking' });
    window.setTimeout(async () => {
      try {
        const res = await fetch('/api/validate-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, code: code.trim() }),
        });
        const body = await res.json();
        if (body?.valid) setPromoState({ kind: 'valid', percentOff: body.percentOff });
        else if (res.ok) setPromoState({ kind: 'invalid', message: body?.message ?? 'That code is not valid for this store.' });
        else setPromoState({ kind: 'idle' }); // rate limited or server error — stay quiet, order validates anyway
      } catch {
        setPromoState({ kind: 'idle' });
      }
    }, 450);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setMessage('');
    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          items: [{ listingId, quantity }],
          customerName: name,
          customerPhone: phone,
          promoCode: promo.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(body?.error?.message ?? 'Could not place this order. Check your details and try again.');
        return;
      }
      setOrderId(body.orderId);
      setPayToken(body.payToken ?? null);
      setStatus('idle');
    } catch {
      setStatus('error');
      setMessage('Network problem — check your connection and try again.');
    }
  }

  if (orderId) {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <div className="card card-elevated" style={{ textAlign: 'center' }}>
          <h1>Order placed</h1>
          <p className="muted">Order reference</p>
          <p className="mono" style={{ fontSize: 18, color: 'var(--blue)' }}>{orderId}</p>
          <p className="muted">Next step: confirm payment to send the order to the seller.</p>
          <Link
            className="btn btn-primary"
            href={payToken ? `/checkout/${orderId}?pt=${payToken}` : `/checkout/${orderId}`}
          >
            Continue to payment
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-narrow" style={{ padding: '48px 20px' }}>
      <h1>Place your order</h1>
      <p className="muted">Your details are used only to process this order and let the seller reach you.</p>
      {message && <div className="alert alert-error">{message}</div>}
      <form onSubmit={submit} className="card">
        <div className="field">
          <label htmlFor="qty">Quantity</label>
          <input
            id="qty"
            type="number"
            min={1}
            max={999}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+234 801 234 5678"
            required
          />
          <p className="hint">International format, e.g. +2348012345678. Used for this order only.</p>
        </div>
        <div className="field">
          <label htmlFor="promo">Discount code (optional)</label>
          <input
            id="promo"
            type="text"
            value={promo}
            onChange={(e) => onPromoChange(e.target.value.toUpperCase())}
            placeholder="e.g. WELCOME10"
            maxLength={40}
            autoCapitalize="characters"
            autoComplete="off"
          />
          {promoState.kind === 'checking' && <p className="hint">Checking code…</p>}
          {promoState.kind === 'valid' && (
            <p className="hint" style={{ color: 'var(--success)', fontWeight: 600 }}>
              ✓ {promoState.percentOff}% off applied — verified live before your order is created.
            </p>
          )}
          {promoState.kind === 'invalid' && (
            <p className="hint" style={{ color: 'var(--danger)' }}>
              {promoState.message}
            </p>
          )}
          {promoState.kind === 'idle' && (
            <p className="hint">Have a code from the seller? It&apos;s validated before your order is created.</p>
          )}
        </div>
        <button className="btn btn-primary" type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Placing order…' : 'Place order'}
        </button>
      </form>
    </main>
  );
}
