'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_GALLERY = 5;

/**
 * Store gallery manager: 1–5 uploaded photos of the shop itself, shown as a
 * swipeable/grid gallery on the store site between the sub-header and the
 * listings. Uploads go to the seller's own RLS folder in store-media.
 */
export function GalleryCard({ initialGallery }: { initialGallery: string[] }) {
  const router = useRouter();
  const [urls, setUrls] = useState<string[]>(initialGallery);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(urls) !== JSON.stringify(initialGallery);

  async function upload(file: File) {
    setError(null);
    if (urls.length >= MAX_GALLERY) {
      setError(`Up to ${MAX_GALLERY} photos.`);
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setError('Images must be JPEG, PNG, WebP or GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Each image must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/listings/upload-image', { method: 'POST', body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Upload failed.');
      setUrls((prev) => (prev.length >= MAX_GALLERY ? prev : [...prev, body.url as string]));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryUrls: urls }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not save the gallery.');
      setMessage('Gallery saved — your store site is updated.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 18 }}>🖼️ Store gallery</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Show buyers the real place: 1–5 photos of your shop, counter or workspace — displayed
        as a gallery on your store site.
      </p>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {urls.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {urls.map((url, i) => (
            <span key={url} style={{ position: 'relative', width: 92, height: 92, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded URL */}
              <img src={url} alt={`Store photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => setUrls((prev) => prev.filter((u) => u !== url))}
                disabled={busy}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                  borderRadius: 999, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff',
                  cursor: 'pointer', fontSize: 12, lineHeight: 1,
                }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {urls.length < MAX_GALLERY && (
        <label className="btn btn-outline btn-sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'Uploading…' : `+ Add photo (${urls.length}/${MAX_GALLERY})`}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = '';
            }}
          />
        </label>
      )}

      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save gallery'}
        </button>
      </div>
    </div>
  );
}
