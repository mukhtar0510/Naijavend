'use client';

// "Store website" preview on the full map: a small, live rendering of the
// store's own site (/s/[slug]) built from the same rows that page reads: the
// seller's theme (colours, fonts, template, hero banner), logo, shop gallery
// and newest listings with their photos and videos. Only the store slug is
// requested, never anything about the buyer.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Flame, Image as IcImage, Play, ShoppingBag, Calendar } from 'lucide-react';
import { STORE_TEMPLATES, formatNaira } from '@idevtenancy/shared';
import { ThemeFonts } from '@/components/ThemeFonts';
import type { StorePreviewData } from '@/app/api/map/store-preview/route';

const cache = new Map<string, StorePreviewData>();

export function StorePreview({ slug, onOpen }: { slug: string; onOpen?: () => void }) {
  const [data, setData] = useState<StorePreviewData | null>(() => cache.get(slug) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    const hit = cache.get(slug);
    setData(hit ?? null);
    if (hit) return;
    const ctrl = new AbortController();
    fetch(`/api/map/store-preview?slug=${encodeURIComponent(slug)}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const body = (await r.json()) as StorePreviewData;
        cache.set(slug, body);
        setData(body);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true);
      });
    return () => ctrl.abort();
  }, [slug]);

  const href = `/s/${slug}`;

  if (failed) {
    return (
      <section className="fmp" aria-label="Store website preview">
        <PreviewHead href={href} onOpen={onOpen} />
        <p className="fmp-note">The preview couldn&apos;t load. Open the store to see it.</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="fmp" aria-label="Store website preview" aria-busy="true">
        <PreviewHead href={href} onOpen={onOpen} />
        <div className="fmp-frame">
          <div className="skeleton" style={{ height: 42 }} />
          <div className="skeleton" style={{ height: 96, marginTop: 8 }} />
          <div className="fmp-grid" style={{ marginTop: 8 }}>
            <div className="skeleton" style={{ height: 120 }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        </div>
      </section>
    );
  }

  const t = data.theme;
  const template = STORE_TEMPLATES.find((x) => x.id === t.layout)?.name ?? 'Modern';
  const vars = {
    '--p-accent': t.accent,
    '--p-accent-text': t.accentText,
    '--p-bg': t.background,
    '--p-text': t.text ?? '#14161A',
    '--p-heading': t.heading ?? t.text ?? '#0B0C0F',
    '--p-muted': t.muted ?? '#5B6170',
    '--p-font-heading': `'${t.fontHeading}', 'Sora', sans-serif`,
    '--p-font-body': `'${t.fontBody}', 'Inter', system-ui, sans-serif`,
    ...(t.backgroundGradient ? { '--p-bg-gradient': t.backgroundGradient } : {}),
    ...(t.heroBg ? { '--p-hero-bg': t.heroBg } : {}),
    ...(t.listingBg ? { '--p-card-bg': t.listingBg } : {}),
    ...(t.listingText ? { '--p-card-text': t.listingText } : {}),
  } as React.CSSProperties;

  return (
    <section className="fmp" aria-label={`${data.name} website preview`}>
      <ThemeFonts />
      <PreviewHead href={href} onOpen={onOpen} />
      <Link href={href} className="fmp-frame fmp-site" style={vars} data-layout={t.layout} data-buttons={t.buttons} onClick={onOpen}>
        <span className="fmp-chrome" aria-hidden>
          <i />
          <i />
          <i />
          <span>kwaravend.ng/s/{data.slug}</span>
        </span>
        {data.announcement && <span className="fmp-announce">{data.announcement}</span>}
        <span className="fmp-mast">
          {data.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded logo
            <img src={data.logo} alt="" className="fmp-logo" />
          ) : (
            <span className="fmp-logo fmp-logo-text" aria-hidden>
              {data.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <strong className="fmp-name">{data.name}</strong>
          <span className="fmp-btn">Shop</span>
        </span>
        <span
          className={`fmp-hero${t.heroBanner ? ' has-image' : ''}`}
          style={t.heroBanner ? { backgroundImage: `url('${t.heroBanner.replace(/'/g, '%27')}')` } : undefined}
        >
          <span className="fmp-hero-title">{data.name}</span>
          {data.description && <span className="fmp-hero-copy">{data.description.slice(0, 110)}{data.description.length > 110 ? '…' : ''}</span>}
        </span>
        {data.gallery.length > 0 && (
          <span className="fmp-gallery">
            {data.gallery.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded gallery photo
              <img key={u} src={u} alt={`${data.name} shop photo ${i + 1}`} loading="lazy" />
            ))}
          </span>
        )}
        {data.listings.length > 0 && (
          <span className="fmp-section-label">
            {data.hasTrending ? (
              <>
                <Flame size={12} aria-hidden /> Trending at {data.name}
              </>
            ) : (
              'Newest from this store'
            )}
          </span>
        )}
        {data.listings.length > 0 ? (
          <span className="fmp-grid">
            {data.listings.map((l) => (
              <span key={l.id} className="fmp-card">
                <span className="fmp-cover">
                  {l.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded listing photo
                    <img src={l.cover} alt="" loading="lazy" />
                  ) : l.video ? (
                    <video src={`${l.video}#t=0.1`} muted playsInline preload="metadata" aria-hidden tabIndex={-1} />
                  ) : l.type === 'service' ? (
                    <Calendar size={20} aria-hidden />
                  ) : (
                    <ShoppingBag size={20} aria-hidden />
                  )}
                  {l.trending && (
                    <span className="fmp-trend-tag">
                      <Flame size={10} aria-hidden /> Trending
                    </span>
                  )}
                  {l.video && (
                    <span className="fmp-video-tag">
                      <Play size={10} aria-hidden /> Video
                    </span>
                  )}
                </span>
                <span className="fmp-card-title">{l.title}</span>
                <span className="fmp-card-price">{formatNaira(l.priceKobo)}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="fmp-empty">
            <IcImage size={16} aria-hidden /> No listings yet.
          </span>
        )}
      </Link>
      <p className="fmp-note">
        {template} template · {data.listingCount} listing{data.listingCount === 1 ? '' : 's'}
        {data.gallery.length > 0 ? ` · ${data.gallery.length} shop photo${data.gallery.length === 1 ? '' : 's'}` : ''}
        {data.isExample ? ' · sample data' : ''}
      </p>
    </section>
  );
}

function PreviewHead({ href, onOpen }: { href: string; onOpen?: () => void }) {
  return (
    <div className="fmp-head">
      <h3>Store website</h3>
      <Link href={href} className="fmp-open" onClick={onOpen}>
        Open <ExternalLink size={13} aria-hidden />
      </Link>
    </div>
  );
}
