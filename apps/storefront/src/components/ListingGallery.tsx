'use client';

import { useState } from 'react';

// Product-page gallery: optional product video first, then big main image
// with a clickable thumbnail strip below.
export function ListingGallery({ images, videoUrl, title }: { images: string[]; videoUrl?: string | null; title: string }) {
  const [active, setActive] = useState(0);
  // Media slots: video (if any) takes slot 0, images follow.
  const hasVideo = !!videoUrl;
  const slots = (hasVideo ? [videoUrl as string, ...images] : images);

  if (slots.length === 0) {
    return (
      <div className="gallery-placeholder" aria-label={`${title} — no photos yet`}>
        🛍️
      </div>
    );
  }

  const showVideo = hasVideo && active === 0;
  const imageIndex = active - (hasVideo ? 1 : 0);

  return (
    <div>
      {showVideo ? (
        <video
          className="gallery-main"
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          aria-label={`${title} — product video`}
          style={{ background: '#000' }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URLs
        <img className="gallery-main" src={images[imageIndex]} alt={`${title} — photo ${imageIndex + 1} of ${images.length}`} />
      )}
      {slots.length > 1 && (
        <div className="gallery-thumbs">
          {hasVideo && (
            <button
              type="button"
              className={`gallery-thumb gallery-thumb-video${active === 0 ? ' is-active' : ''}`}
              onClick={() => setActive(0)}
              aria-label="Play product video"
            >
              ▶
            </button>
          )}
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URLs
            <img
              key={src}
              src={src}
              alt={`${title} thumbnail ${i + 1}`}
              className={`gallery-thumb${active === i + (hasVideo ? 1 : 0) ? ' is-active' : ''}`}
              onClick={() => setActive(i + (hasVideo ? 1 : 0))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
