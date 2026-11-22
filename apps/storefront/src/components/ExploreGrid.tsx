'use client';

// Discover "Explore" grid: a dense three-column mosaic of listings and stores
// from across Ilorin, with a tall tile in every block of ten (left and right
// alternate), in the manner of a photo-app explore page. Real media only:
// seller photos and videos; a tile without media shows the item's own name
// and price on its trade colour, never a stock photo.
//
// Videos play muted while on screen and stop when scrolled away (never when
// the viewer asked for reduced motion).

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Play, Store as StoreIcon } from 'lucide-react';
import { formatNaira } from '@idevtenancy/shared';
import { CategoryIcon, categoryColor, categoryMeta } from '@/lib/categories';

export type ExploreTile =
  | {
      kind: 'listing';
      key: string;
      href: string;
      title: string;
      priceKobo: number;
      storeName: string;
      category: string;
      image: string | null;
      video: string | null;
      isExample: boolean;
    }
  | {
      kind: 'store';
      key: string;
      href: string;
      title: string;
      area: string | null;
      category: string;
      image: string | null;
      logo: string | null;
      isExample: boolean;
    };

function TileVideo({ src, poster }: { src: string; poster: string | null }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.6 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      className="ex-media"
      src={poster ? src : `${src}#t=0.1`}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
      tabIndex={-1}
    />
  );
}

export function ExploreGrid({ tiles }: { tiles: ExploreTile[] }) {
  return (
    <div className="ex-grid">
      {tiles.map((t) => {
        const color = categoryColor(t.category);
        const label =
          t.kind === 'listing'
            ? `${t.title}, ${formatNaira(t.priceKobo)}, from ${t.storeName}${t.video ? ', has a video' : ''}`
            : `${t.title} store${t.area ? ` in ${t.area}` : ''}`;
        const hasMedia = !!t.image || (t.kind === 'listing' && !!t.video);
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`ex-tile${hasMedia ? ' has-media' : ' is-text'} is-${t.kind}`}
            style={{ ['--tile' as string]: color }}
            aria-label={label}
          >
            {t.kind === 'listing' && t.video ? (
              <TileVideo src={t.video} poster={t.image} />
            ) : t.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded media
              <img className="ex-media" src={t.image} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="ex-text" aria-hidden>
                <span className="ex-text-icon">
                  {t.kind === 'store' && t.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded logo
                    <img src={t.logo} alt="" />
                  ) : (
                    <CategoryIcon category={t.category} size={22} />
                  )}
                </span>
                <span className="ex-text-title">{t.title}</span>
                <span className="ex-text-sub">
                  {t.kind === 'listing' ? formatNaira(t.priceKobo) : (t.area ?? categoryMeta(t.category).label)}
                </span>
              </span>
            )}
            <span className="ex-badges" aria-hidden>
              {t.kind === 'listing' && t.video && <Play size={15} fill="currentColor" />}
              {t.kind === 'store' && <StoreIcon size={15} />}
            </span>
            {t.isExample && <span className="ex-example" aria-hidden>Example</span>}
            {hasMedia && (
              <span className="ex-caption" aria-hidden>
                <strong>{t.title}</strong>
                <span>{t.kind === 'listing' ? `${formatNaira(t.priceKobo)} · ${t.storeName}` : (t.area ?? categoryMeta(t.category).label)}</span>
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
