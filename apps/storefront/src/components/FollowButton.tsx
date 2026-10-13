'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Server-side "Follow store" toggle — drives the alerts inbox (new products +
// price drops fan out from DB triggers). Signed-out visitors are bounced to
// sign-in with a ?next= back to this store.
export function FollowButton({ storeId, storeName }: { storeId: string; storeName: string }) {
  const router = useRouter();
  const [following, setFollowing] = useState<boolean | null>(null); // null = still loading
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/follows?storeId=${encodeURIComponent(storeId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { following: boolean };
        if (alive) setFollowing(json.following);
      } catch {
        /* leave as loading; button still works on click */
      }
    })();
    return () => {
      alive = false;
    };
  }, [storeId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeId }),
      });
      if (res.status === 401) {
        router.push(`/account/signin?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const json = (await res.json()) as { following?: boolean; error?: { message?: string } };
      if (!res.ok) {
        alert(json.error?.message ?? 'Could not update follow.');
        return;
      }
      setFollowing(Boolean(json.following));
      router.refresh();
    } catch {
      alert('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  const isFollowing = following === true;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`btn btn-sm ${isFollowing ? 'btn-ghost' : 'btn-primary'}`}
      aria-pressed={isFollowing}
      title={isFollowing ? `Unfollow ${storeName}` : `Get alerts from ${storeName}`}
      style={{ minWidth: 118 }}
    >
      {busy ? '…' : isFollowing ? '🔔 Following' : '🔔 Follow'}
    </button>
  );
}
