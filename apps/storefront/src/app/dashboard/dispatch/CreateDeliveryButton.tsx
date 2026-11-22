'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

export function CreateDeliveryButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/dashboard/deliveries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', orderId }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? 'Could not create.');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button type="button" className="btn btn-outline btn-sm" onClick={create} disabled={busy}>
        <Plus size={14} aria-hidden /> {busy ? 'Adding…' : 'Add to board'}
      </button>
      {err && <span style={{ color: 'var(--danger)', fontSize: 12.5 }}>{err}</span>}
    </span>
  );
}
