'use client';

// Route-level error boundary. Without this, a thrown server render or a failed
// client import shows the browser's raw Next error page in production.
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the digest: it is the only handle support has on a server-side error.
    console.error('[Kwaravend] route error', error.digest ?? '', error.message);
  }, [error]);

  return (
    <main className="container" style={{ padding: '48px 20px', maxWidth: 640 }}>
      <h1 style={{ marginBottom: 8 }}>Something broke on our side</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        This page did not load. Your data is safe — try again, and if it keeps happening send us
        the reference below.
      </p>
      {error.digest && (
        <p className="mono" style={{ fontSize: 13, marginBottom: 20 }}>
          Reference: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/home" className="btn btn-outline">
          Back to the homepage
        </Link>
      </div>
    </main>
  );
}
