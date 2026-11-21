'use client';

// StoreCard (REDESIGN_V2 §6.3): photo, logo, name, category chip, rating only
// with real reviews, green "Open now" dot, area, and one quick Order button.
// Tilts on hover and focus (TiltCard); press scale 0.97.

import Link from 'next/link';
import { ArrowRight, MapPin, Star } from 'lucide-react';
import { categoryLabel } from '@idevtenancy/shared';
import { CategoryIcon } from '@/lib/categories';
import { TiltCard } from '@/components/depth/TiltCard';
import { VerifiedTick } from '@/components/VerifiedTick';
import { ExampleTag } from '@/components/ExampleStoreBanner';
import type { HomeStore } from './types';

export function StoreCard({ store, open, highlighted }: { store: HomeStore; open: boolean; highlighted?: boolean }) {
  return (
    <TiltCard as="article" className={highlighted ? 'kvs-card is-highlighted' : 'kvs-card'} aria-label={store.name}>
      <div
        className="kvs-banner"
        style={store.banner ? { backgroundImage: `url('${store.banner}')` } : undefined}
        data-cat={store.category}
      >
        <span className="kvs-cat">
          <CategoryIcon category={store.category} size={14} />
          {categoryLabel(store.category)}
        </span>
        {open && (
          <span className="kvs-open">
            <i aria-hidden /> Open now
          </span>
        )}
      </div>
      <div className="kvs-body">
        <div className="kvs-head">
          {store.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
            <img className="kvs-logo" src={store.logo} alt="" loading="lazy" />
          ) : (
            <span className="kvs-logo kvs-logo-fallback" aria-hidden>
              {store.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="kvs-id">
            <h3>
              <Link href={`/s/${store.slug}`} className="kvs-link">
                {store.name}
              </Link>
              {store.verified && <VerifiedTick size={14} />}
              {store.isExample && <ExampleTag />}
            </h3>
            <span className="kvs-meta">
              {store.reviewCount > 0 ? (
                <span className="kvs-rating">
                  <Star size={12} aria-hidden /> {store.avgStars.toFixed(1)}
                  <em>({store.reviewCount})</em>
                </span>
              ) : (
                <em>New, no reviews yet</em>
              )}
              {store.areaLabel && (
                <span className="kvs-area">
                  <MapPin size={12} aria-hidden /> {store.areaLabel}
                </span>
              )}
            </span>
          </div>
        </div>
        <Link href={`/s/${store.slug}`} className="btn btn-primary btn-sm kvs-order" tabIndex={-1} aria-hidden>
          {store.isExample ? 'View example' : 'Order'} <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </TiltCard>
  );
}
