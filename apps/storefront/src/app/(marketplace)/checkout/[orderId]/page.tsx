'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { orderRef } from '@idevtenancy/shared';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/payments';
import { PaymentProofUpload } from './PaymentProofUpload';
import { ArrowLeft, CircleCheck, Download, Star, Store, Zap } from 'lucide-react';
import { OrderStepper } from '@/components/orders/OrderStepper';
import { zoneLabel } from '@/lib/deliveryZones';

interface CheckoutData {
  orderId: string;
  storeName: string;
  storeSlug: string;
  totalKobo: number;
  status: string;
  deliveryMethod?: string;
  deliveryZone?: string;
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
      <main className="order-page">
        <div className="alert alert-error">{error}</div>
        <Link className="btn btn-outline" href="/home">
          <ArrowLeft size={16} aria-hidden /> Back home
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="order-page" aria-busy="true">
        <div className="skeleton" style={{ height: 120, borderRadius: 22 }} />
        <div className="skeleton" style={{ height: 180, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 160, borderRadius: 20 }} />
      </main>
    );
  }

  const paid = data.status === 'paid' || data.status === 'fulfilled' || data.paymentStatus === 'paid';
  const closed = !paid && data.status !== 'pending';
  const deliveryLabel =
    data.deliveryMethod === 'pickup'
      ? 'Pickup'
      : data.deliveryMethod === 'rider'
        ? 'Same-city rider'
        : data.deliveryMethod === 'zone'
          ? `Delivery to ${zoneLabel(data.deliveryZone) || 'your zone'}`
          : 'Courier';

  return (
    <main className="order-page">
      <header className="order-head">
        {paid && (
          <span className="order-success" aria-hidden>
            <CircleCheck size={30} />
          </span>
        )}
        <h1>{paid ? 'Payment confirmed' : closed ? `Order ${data.status}` : 'Your order is in'}</h1>
        <p className="order-ref">
          <Store size={15} aria-hidden /> {data.storeName} · Order <code>{orderRef(data.orderId)}</code>
        </p>
        {paid && (
          <p className="muted" style={{ margin: 0 }}>
            {data.storeName} confirmed your payment of {naira(data.totalKobo)}. They will contact you on the number
            you gave.
          </p>
        )}
        {closed && (
          <p className="muted" style={{ margin: 0 }}>
            This order is {data.status} and can no longer be paid.
          </p>
        )}
      </header>

      <OrderStepper
        status={data.status}
        paymentStatus={data.paymentStatus}
        paymentMethod={data.paymentMethod}
        deliveryMethod={data.deliveryMethod}
      />

      {paid && data.digitalDownloads && data.digitalDownloads.length > 0 && (
        <section className="order-card">
          <h2>
            <Zap className="ico-inline" aria-hidden /> Your downloads are ready
          </h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Each link works once. Download now and save your file.
          </p>
          <div className="order-actions">
            {data.digitalDownloads.map((d) => (
              <a key={d.downloadUrl} href={d.downloadUrl} className="btn btn-primary" download>
                <Download size={16} aria-hidden /> Download {d.fileName}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="order-card" aria-labelledby="summary-title">
        <h2 id="summary-title">Order summary</h2>
        <ul className="order-lines">
          {data.items.map((item, i) => (
            <li key={i}>
              <span>
                {item.title} × {item.quantity}
              </span>
              <span>{naira(item.unitPriceKobo * item.quantity)}</span>
            </li>
          ))}
          {data.deliveryMethod && (
            <li>
              <span>{deliveryLabel.startsWith('Delivery to') ? deliveryLabel : `Delivery: ${deliveryLabel}`}</span>
              <span>{naira(data.deliveryFeeKobo ?? 0)}</span>
            </li>
          )}
        </ul>
        <div className="order-total">
          <span>Total</span>
          <span>{naira(data.totalKobo)}</span>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      {!paid && !closed && (
        <section className="order-card" aria-labelledby="pay-title">
          <h2 id="pay-title">How to pay</h2>
          {data.paymentMethod === 'bank_transfer' ? (
            <>
              <p style={{ marginTop: 0 }}>
                Transfer <strong className="mono">{naira(data.totalKobo)}</strong> to {data.storeName} using the account
                details they gave you, then upload the receipt below so they can confirm it.
              </p>
              <PaymentProofUpload orderId={data.orderId} token={payToken} existingUrl={data.paymentProofUrl ?? null} />
            </>
          ) : data.paymentMethod === 'pay_on_pickup' ? (
            <p style={{ marginTop: 0 }}>
              Pay <strong className="mono">{naira(data.totalKobo)}</strong> when you collect the order from{' '}
              {data.storeName}. The seller confirms the payment in their dashboard.
            </p>
          ) : data.paymentMethod === 'cash_on_delivery' ? (
            <p style={{ marginTop: 0 }}>
              Pay <strong className="mono">{naira(data.totalKobo)}</strong> in cash when {data.storeName} delivers.
              The seller confirms the payment in their dashboard.
            </p>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>
                {data.storeName} has not set a payment method yet. Contact them to agree how to pay{' '}
                <strong className="mono">{naira(data.totalKobo)}</strong>. If you paid by transfer, upload the receipt
                below.
              </p>
              <PaymentProofUpload orderId={data.orderId} token={payToken} existingUrl={data.paymentProofUrl ?? null} />
            </>
          )}
          {data.paymentStatus === 'awaiting_confirmation' && (
            <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Receipt received. Waiting for {data.storeName} to confirm the money.
            </p>
          )}
          {data.paymentMethod && data.paymentMethod !== 'bank_transfer' && (
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
              Payment method: {PAYMENT_METHOD_LABEL[data.paymentMethod as PaymentMethod]}. Kwaravend never takes card
              payments and adds no fee.
            </p>
          )}
        </section>
      )}

      <div className="order-actions">
        {paid && (
          <Link className="btn btn-primary" href={`/s/${data.storeSlug}/rate`}>
            <Star size={16} aria-hidden /> Rate this store
          </Link>
        )}
        <Link className="btn btn-outline" href={`/s/${data.storeSlug}`}>
          <ArrowLeft size={16} aria-hidden /> Back to {data.storeName}
        </Link>
      </div>
    </main>
  );
}
