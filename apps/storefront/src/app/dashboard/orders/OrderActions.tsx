'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: 'fulfilled' | 'cancelled') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/orders/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, next }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.message ?? 'Could not update this order.');
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {error && <span className="muted" style={{ fontSize: 13 }}>{error}</span>}
      {status === 'paid' && (
        <button className="btn btn-primary btn-sm" onClick={() => transition('fulfilled')} disabled={busy}>
          Mark fulfilled
        </button>
      )}
      {(status === 'paid' || status === 'pending') && (
        <button className="btn btn-outline btn-sm" onClick={() => transition('cancelled')} disabled={busy}>
          Cancel
        </button>
      )}
    </div>
  );
}
