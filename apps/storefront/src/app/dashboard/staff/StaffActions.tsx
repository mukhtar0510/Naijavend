'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StaffToggle({ staffId, slug, active }: { staffId: string; slug: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      className="btn btn-outline btn-sm"
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/staff', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, staffId, active: !active }),
        });
        router.refresh();
        setBusy(false);
      }}
    >
      {active ? 'Suspend' : 'Reactivate'}
    </button>
  );
}

export function StaffRemove({ staffId, slug }: { staffId: string; slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      className="btn btn-outline btn-sm"
      type="button"
      disabled={busy}
      style={{ color: 'var(--danger)' }}
      onClick={async () => {
        if (!confirm('Remove this staff member? Their sign-in will be revoked immediately.')) return;
        setBusy(true);
        await fetch('/api/staff', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, staffId }),
        });
        router.refresh();
        setBusy(false);
      }}
    >
      Remove
    </button>
  );
}
