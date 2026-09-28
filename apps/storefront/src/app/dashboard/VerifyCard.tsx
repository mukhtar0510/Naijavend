'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VerifiedTick } from '@/components/VerifiedTick';

const REVIEWS_REQUIRED = 30;
const AVG_REQUIRED = 4.0;

// Dashboard card: blue-tick verification progress + application.
export function VerifyCard({
  reviewCount,
  avgStars,
  status,
}: {
  reviewCount: number;
  avgStars: number | null;
  status: 'unverified' | 'verified';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const avg = avgStars != null ? Number(avgStars) : 0;
  const eligible = reviewCount >= REVIEWS_REQUIRED && avg >= AVG_REQUIRED;
  const progress = Math.min(100, Math.round((reviewCount / REVIEWS_REQUIRED) * 100));

  async function apply() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/verification/apply', { method: 'POST' });
      const body = (await res.json()) as { verified?: boolean; error?: { message?: string } };
      if (res.ok && body.verified) {
        setMsg('Verified! Your blue tick is live.');
        router.refresh();
      } else {
        setMsg(body.error?.message ?? 'Could not apply right now.');
      }
    } catch {
      setMsg('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'verified') {
    return (
      <div className="card card-elevated verify-card is-verified">
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Verification</p>
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, margin: '6px 0', fontWeight: 700 }}>
          <VerifiedTick size={22} /> Verified store
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
          Your blue tick shows shoppers that your store is trusted.
        </p>
      </div>
    );
  }

  return (
    <div className="card card-elevated verify-card">
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Verification</p>
      <p style={{ margin: '6px 0', fontSize: 16, fontWeight: 700 }}>Get the blue tick ✔</p>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 13.5 }}>
        Verified stores are badged everywhere on Naijavend. Requirement:{' '}
        <strong>{REVIEWS_REQUIRED}+ reviews</strong> averaging <strong>{AVG_REQUIRED}+ stars</strong>.
      </p>
      <div className="verify-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
        {reviewCount}/{REVIEWS_REQUIRED} reviews
        {reviewCount > 0 ? ` · ${avg.toFixed(1)}★ average` : ''}{' '}
        {avg > 0 && avg < AVG_REQUIRED ? `· needs ${AVG_REQUIRED}+★ average` : ''}
      </p>
      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={!eligible || busy} onClick={apply}>
          {busy ? 'Applying…' : 'Apply for verification'}
        </button>
        {!eligible && (
          <span className="muted" style={{ fontSize: 12.5 }}>
            Keep collecting reviews — {Math.max(0, REVIEWS_REQUIRED - reviewCount)} to go.
          </span>
        )}
      </div>
      {msg && <p className={msg.startsWith('Verified') ? 'alert alert-success' : 'alert alert-error'} style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}
