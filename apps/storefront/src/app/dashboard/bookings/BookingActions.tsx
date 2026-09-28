'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BookingActions({ bookingId, status }: { bookingId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function transition(next: 'confirmed' | 'completed' | 'cancelled') {
    setBusy(true);
    try {
      await fetch('/api/bookings/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {status === 'pending' && (
        <button className="btn btn-primary btn-sm" onClick={() => transition('confirmed')} disabled={busy}>Confirm</button>
      )}
      {status === 'confirmed' && (
        <button className="btn btn-primary btn-sm" onClick={() => transition('completed')} disabled={busy}>Mark completed</button>
      )}
      {status === 'pending' && (
        <button className="btn btn-outline btn-sm" onClick={() => transition('cancelled')} disabled={busy}>Decline</button>
      )}
    </div>
  );
}
