'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CheckoutData {
  orderId: string;
  storeName: string;
  storeSlug: string;
  totalKobo: number;
  status: string;
  items: Array<{ title: string; quantity: number; unitPriceKobo: number }>;
}

function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export default function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [data, setData] = useState<CheckoutData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    params.then((p) => setOrderId(p.orderId));
  }, [params]);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/checkout-summary?orderId=${encodeURIComponent(orderId)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? 'Could not load this order.');
        setData(body);
      })
      .catch((err: Error) => setError(err.message));
  }, [orderId]);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch('/api/mock-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Payment failed.');
      setPaid(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPaying(false);
    }
  }

  if (error && !data) {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <div className="alert alert-error">{error}</div>
        <Link href="/">← Back home</Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 48, width: 200 }} />
      </main>
    );
  }

  if (paid || data.status === 'paid') {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <div className="card card-elevated" style={{ textAlign: 'center' }}>
          <h1 style={{ color: 'var(--success)' }}>Payment confirmed</h1>
          <p className="muted">Receipt</p>
          <p className="mono" style={{ color: 'var(--blue)' }}>{data.orderId}</p>
          <p>
            {data.storeName} received {naira(data.totalKobo)}. The seller has been notified and will contact you on
            the number you provided.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href={`/s/${data.storeSlug}/rate`}>
              Rate this store
            </Link>
            <Link className="btn btn-outline" href={`/s/${data.storeSlug}`}>
              Back to store
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (data.status !== 'pending') {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <div className="alert alert-error">This order is {data.status} and can no longer be paid.</div>
        <Link href={`/s/${data.storeSlug}`}>← Back to {data.storeName}</Link>
      </main>
    );
  }

  return (
    <main className="container-narrow" style={{ padding: '48px 20px' }}>
      <h1>Checkout</h1>
      <p className="muted">Order <span className="mono">{data.orderId}</span></p>

      <div className="card card-elevated" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18 }}>{data.storeName}</h2>
        {data.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span>
              {item.title} × {item.quantity}
            </span>
            <span className="mono">{naira(item.unitPriceKobo * item.quantity)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, fontWeight: 700 }}>
          <span>Total</span>
          <span className="mono" style={{ color: 'var(--blue)' }}>{naira(data.totalKobo)}</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <button className="btn btn-primary" onClick={pay} disabled={paying} style={{ width: '100%' }}>
        {paying ? 'Processing payment…' : `Pay ${naira(data.totalKobo)}`}
      </button>
      <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
        Demo payment flow — no real money moves. In production this hands off to Paystack, and only a
        signature-verified webhook can mark an order paid.
      </p>
    </main>
  );
}
