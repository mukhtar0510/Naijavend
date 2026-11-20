'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { orderRef } from '@idevtenancy/shared';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/payments';
import { PaymentProofUpload } from './PaymentProofUpload';
import { Zap as IcZap } from 'lucide-react';
import { Download as IcDownload } from 'lucide-react';

interface CheckoutData {
  orderId: string;
  storeName: string;
  storeSlug: string;
  totalKobo: number;
  status: string;
  deliveryMethod?: string;
  deliveryFeeKobo?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentProofUrl?: string | null;
  items: Array<{ title: string; quantity: number; unitPriceKobo: number }>;
  digitalDownloads?: Array<{ title: string; fileName: string; downloadUrl: string }>;
}

function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export default function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ pt?: string }>;
}) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [payToken, setPayToken] = useState('');
  const [data, setData] = useState<CheckoutData | null>(null);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    params.then((p) => setOrderId(p.orderId));
    searchParams.then((p) => setPayToken(p.pt ?? ''));
  }, [params, searchParams]);

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

  if (error && !data) {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <div className="alert alert-error">{error}</div>
        <Link href="/home">← Back home</Link>
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

  if (data.status === 'paid' || data.paymentStatus === 'paid') {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <div className="card card-elevated" style={{ textAlign: 'center' }}>
          <h1 style={{ color: 'var(--success)' }}>Payment confirmed</h1>
          <p className="muted">Receipt</p>
          <p className="mono" style={{ color: 'var(--blue)' }}>{orderRef(data.orderId)}</p>
          <p>
            {data.storeName} received {naira(data.totalKobo)}. The seller has been notified and will contact you on
            the number you provided.
          </p>
          {data.digitalDownloads && data.digitalDownloads.length > 0 && (
            <div style={{ margin: '18px 0 4px', padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--elevated-2)', textAlign: 'left' }}>
              <strong style={{ fontSize: 15 }}><IcZap className="ico-inline" aria-hidden /> Your downloads are ready</strong>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Each link works once — download now and save your file.
              </p>
              {data.digitalDownloads.map((d) => (
                <a key={d.downloadUrl} href={d.downloadUrl} className="btn btn-primary" style={{ margin: '6px 8px 6px 0' }} download>
                  <IcDownload className="ico-inline" aria-hidden /> Download {d.fileName}
                </a>
              ))}
            </div>
          )}
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
      <p className="muted">Order <span className="mono">{orderRef(data.orderId)}</span></p>

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
        {data.deliveryMethod && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span>
              Delivery — {data.deliveryMethod === 'pickup' ? 'Pickup' : data.deliveryMethod === 'rider' ? 'Same-city rider' : 'Nationwide courier'}
            </span>
            <span className="mono">{naira(data.deliveryFeeKobo ?? 0)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, fontWeight: 700 }}>
          <span>Total</span>
          <span className="mono" style={{ color: 'var(--blue)' }}>{naira(data.totalKobo)}</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h2 style={{ fontSize: 17, marginTop: 0 }}>How to pay</h2>
        {data.paymentMethod === 'bank_transfer' ? (
          <>
            <p style={{ marginTop: 0 }}>
              Transfer <strong className="mono">{naira(data.totalKobo)}</strong> to{' '}
              {data.storeName} using the account details they gave you, then upload the receipt
              below so they can confirm it.
            </p>
            <PaymentProofUpload
              orderId={data.orderId}
              token={payToken}
              existingUrl={data.paymentProofUrl ?? null}
            />
          </>
        ) : data.paymentMethod === 'pay_on_pickup' ? (
          <p style={{ marginTop: 0 }}>
            Pay <strong className="mono">{naira(data.totalKobo)}</strong> when you collect the
            order from {data.storeName}. The seller confirms the payment in their dashboard.
          </p>
        ) : data.paymentMethod === 'cash_on_delivery' ? (
          <p style={{ marginTop: 0 }}>
            Pay <strong className="mono">{naira(data.totalKobo)}</strong> in cash when{' '}
            {data.storeName} delivers. The seller confirms the payment in their dashboard.
          </p>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              {data.storeName} has not set a payment method yet — contact them to agree how to pay{}
              <strong className="mono"> {naira(data.totalKobo)}</strong>. If you paid by transfer,
              upload the receipt below.
            </p>
            <PaymentProofUpload
              orderId={data.orderId}
              token={payToken}
              existingUrl={data.paymentProofUrl ?? null}
            />
          </>
        )}
        {data.paymentStatus === 'awaiting_confirmation' && (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            Receipt received — waiting for {data.storeName} to confirm the money.
          </p>
        )}
        {data.paymentMethod && data.paymentMethod !== 'bank_transfer' && (
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
            Payment method: {PAYMENT_METHOD_LABEL[data.paymentMethod as PaymentMethod]}. Kwaravend
            never takes card payments and adds no fee.
          </p>
        )}
      </div>
    </main>
  );
}
