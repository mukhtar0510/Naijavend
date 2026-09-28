'use client';

import { useEffect, useState } from 'react';

export type LocationBranch = {
  id: string;
  label: string;
  position: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  note: string;
  image_url: string | null;
};

// "Our locations" grid for the store page. Clicking a branch photo opens a
// full-screen lightbox with prev/next navigation between locations.
export function LocationsGallery({ branches }: { branches: LocationBranch[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const withPhotos = branches.map((b, i) => ({ b, i })).filter(({ b }) => !!b.image_url);
  const open = openIdx !== null ? branches[openIdx] : null;

  useEffect(() => {
    if (openIdx === null) return;
    const photoCount = withPhotos.length;
    const step = (dir: 1 | -1) =>
      setOpenIdx((cur) => {
        if (cur === null) return cur;
        // Move to the next/previous branch that has a photo
        let j = cur;
        for (let n = 0; n < branches.length; n++) {
          j = (j + dir + branches.length) % branches.length;
          if (branches[j].image_url) return j;
        }
        return cur;
      });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIdx(null);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- branches is stable server data
  }, [openIdx]);

  const photoNumber = (idx: number) => withPhotos.findIndex(({ i }) => i === idx) + 1;

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
      {branches.map((b, i) => (
        <div key={b.id} className="card" style={{ overflow: 'hidden' }}>
          {b.image_url && (
            <button
              type="button"
              className="loc-photo-btn"
              aria-label={`View photo of ${b.label || `Store ${i + 1}`}`}
              onClick={() => setOpenIdx(i)}
              style={{ position: 'relative', display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'zoom-in' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded URL */}
              <img
                src={b.image_url}
                alt={`${b.label || `Store ${i + 1}`} — photo`}
                loading="lazy"
                style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }}
              />
              <span className="loc-photo-hint" aria-hidden="true">⤢</span>
            </button>
          )}
          <div style={{ padding: '12px 14px 14px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>
              📍 {b.label || `Store ${i + 1}`}
            </h3>
            {b.note && <p className="muted" style={{ margin: '0 0 4px', fontSize: 13 }}>{b.note}</p>}
            {b.address && <p style={{ margin: '4px 0', fontSize: 14.5 }}>{b.address}</p>}
            {b.phone && (
              <p style={{ margin: '4px 0', fontSize: 14.5 }}>
                📞 <a href={`tel:${b.phone.replace(/[^+0-9]/g, '')}`}>{b.phone}</a>
              </p>
            )}
            {b.latitude != null && b.longitude != null && (
              <a
                className="btn btn-outline btn-sm"
                style={{ marginTop: 6 }}
                href={`https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Directions ↗
              </a>
            )}
          </div>
        </div>
      ))}

      {open && open.image_url && (
        <div className="loc-lightbox" role="dialog" aria-modal="true" aria-label={open.label || 'Location photo'} onClick={() => setOpenIdx(null)}>
          <div className="loc-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded URL */}
            <img src={open.image_url} alt={`${open.label || 'Location'} — ${open.address}`} />
            <div className="loc-lightbox-caption">
              <strong>📍 {open.label || `Store ${(openIdx ?? 0) + 1}`}</strong>
              <span>{open.address}</span>
            </div>
            {withPhotos.length > 1 && (
              <div className="loc-lightbox-nav">
                <button type="button" aria-label="Previous photo" onClick={() => setOpenIdx((cur) => (cur === null ? null : (cur - 1 + branches.length) % branches.length))}>←</button>
                <span>{photoNumber(openIdx ?? 0)} / {withPhotos.length}</span>
                <button type="button" aria-label="Next photo" onClick={() => setOpenIdx((cur) => (cur === null ? null : (cur + 1) % branches.length))}>→</button>
              </div>
            )}
            <button type="button" className="loc-lightbox-close" aria-label="Close photo viewer" onClick={() => setOpenIdx(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
