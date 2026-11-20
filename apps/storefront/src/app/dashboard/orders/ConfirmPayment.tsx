'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/** Seller confirms cash/transfer/pickup money that arrived outside the platform. */
export function ConfirmPayment({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/orders/payment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not confirm that payment.');
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <button type="button" className="btn btn-primary btn-sm" onClick={confirm} disabled={disabled}>
        {disabled ? 'Confirming…' : 'Confirm payment received'}
      </button>
      {error && (
        <span className="muted" style={{ fontSize: 12, maxWidth: 220 }}>
          {error}
        </span>
      )}
    </span>
  );
}
