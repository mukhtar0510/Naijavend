'use client';

import { useRef, useState } from 'react';

/**
 * Bank-transfer receipt upload. Guests are authorised by the signed-in customer
 * session or the payment token in the link, never by the order id alone.
 */
export function PaymentProofUpload({
  orderId,
  token,
  existingUrl,
}: {
  orderId: string;
  token: string;
  existingUrl?: string | null;
}) {
  const [state, setState] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setState('uploading');
    setError('');
    try {
      const form = new FormData();
      form.append('orderId', orderId);
      form.append('token', token);
      form.append('file', file);
      const res = await fetch('/api/orders/proof', { method: 'POST', body: form });
      const body = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(body.error?.message ?? 'Could not upload that receipt.');
        setState('idle');
        return;
      }
      setState('done');
    } catch {
      setError('Network problem — try again.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <p className="muted" style={{ fontSize: 14 }}>
        ✅ Receipt sent. The seller will confirm your payment and contact you on the number you
        gave.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <label htmlFor="proof" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
        Upload your transfer receipt
        <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>
          JPG, PNG, WebP or PDF, up to 5 MB.
        </span>
      </label>
      <input
        ref={inputRef}
        id="proof"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setFileName(f.name);
          void upload(f);
        }}
        disabled={state === 'uploading'}
      />
      {state === 'uploading' && (
        <p className="muted" style={{ fontSize: 13 }}>Uploading {fileName}…</p>
      )}
      {error && (
        <p className="muted" style={{ color: 'var(--danger, #b42318)', fontSize: 13 }}>{error}</p>
      )}
      {existingUrl && state === 'idle' && (
        <p className="muted" style={{ fontSize: 13 }}>
          A receipt is already attached.{' '}
          <a href={existingUrl} target="_blank" rel="noopener noreferrer">
            View it
          </a>
          . Uploading another replaces it.
        </p>
      )}
    </div>
  );
}
