'use client';

import { useEffect, useState } from 'react';
import { PAYMENT_METHODS } from '@/lib/payments';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Check as IcCheck } from 'lucide-react';

function naira(kobo: number) {
  return kobo === 0 ? 'Free' : `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

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
  // Delivery options configured by the seller (pickup / rider / courier).
  const [deliveryOptions, setDeliveryOptions] = useState<Array<{ method: string; label: string; feeKobo: number }>>([]);
  const [deliveryMethod, setDeliveryMethod] = useState('');
  // No gateway: the buyer picks how they will pay and the seller confirms it.
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery' | 'bank_transfer' | 'pay_on_pickup'>('cash_on_delivery');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/delivery-options?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { options: Array<{ method: string; label: string; feeKobo: number }> };
        if (!alive) return;
        setDeliveryOptions(json.options);
        // Default to the first available option (usually pickup).
        if (json.options.length > 0) setDeliveryMethod((m) => m || json.options[0].method);
      } catch {
        /* store has no structured options — order ships with free-form delivery */
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

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
          deliveryMethod: deliveryMethod || undefined,
          paymentMethod,
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
          <p className="muted">
            The seller has been given your order. Pay them directly — Kwaravend does not take
            card payments.
          </p>
          <Link
            className="btn btn-primary"
            href={payToken ? `/checkout/${orderId}?pt=${payToken}` : `/checkout/${orderId}`}
          >
            View order &amp; next steps
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
        {deliveryOptions.length > 0 && (
          <div className="field">
            <label>Delivery option</label>
            <div style={{ display: 'grid', gap: 8 }}>
              {deliveryOptions.map((o) => (
                <label
                  key={o.method}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderColor: deliveryMethod === o.method ? 'var(--blue)' : undefined,
                  }}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value={o.method}
                    checked={deliveryMethod === o.method}
                    onChange={() => setDeliveryMethod(o.method)}
                  />
                  <span style={{ flex: 1, fontSize: 14.5 }}>{o.label}</span>
                  <strong style={{ fontSize: 14 }}>{naira(o.feeKobo)}</strong>
                </label>
              ))}
            </div>
            <p className="hint">Fee is set by the store and added to your total before payment.</p>
          </div>
        )}
        <div className="field">
          <label>How will you pay?</label>
          <div style={{ display: 'grid', gap: 8 }}>
            {PAYMENT_METHODS.map((m) => (
              <label
                key={m.id}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderColor: paymentMethod === m.id ? 'var(--blue)' : undefined,
                }}
              >
                <input
                  type="radio"
                  name="payment"
                  value={m.id}
                  checked={paymentMethod === m.id}
                  onChange={() => setPaymentMethod(m.id)}
                />
                <span style={{ flex: 1, fontSize: 14.5 }}>
                  {m.label}
                  <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="hint">The seller confirms the money after you pay them. Nothing is charged here.</p>
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
              <IcCheck className="ico-inline" aria-hidden /> {promoState.percentOff}% off applied — verified live before your order is created.
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
