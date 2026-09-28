'use client';

import { useEffect } from 'react';

// Records a product/service view into localStorage ("sf-recent-products") so
// My account can show a "Recently viewed" row. Local to this browser.
const KEY = 'sf-recent-products';
const MAX = 8;

export interface RecentProduct {
  id: string;
  title: string;
  priceKobo: number;
  type: string;
  imageUrl: string | null;
  storeName: string;
  storeSlug: string;
  compareAtKobo?: number | null;
  stock?: number | null;
}

export function RecordProductView(props: Omit<RecentProduct, never>) {
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
      const list = Array.isArray(raw) ? raw : [];
      const entry: RecentProduct = {
        id: props.id,
        title: props.title,
        priceKobo: props.priceKobo,
        type: props.type,
        imageUrl: props.imageUrl,
        storeName: props.storeName,
        storeSlug: props.storeSlug,
        compareAtKobo: props.compareAtKobo ?? null,
        stock: props.stock ?? null,
      };
      const next = [entry, ...list.filter((e) => (e as RecentProduct)?.id !== entry.id)].slice(0, MAX);
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable — silently skip.
    }
  }, [props]);

  return null;
}

/** Reads the recorded product history, newest first. */
export function getRecentProducts(): RecentProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw)
      ? raw.filter((e): e is RecentProduct => !!e && typeof (e as RecentProduct)?.id === 'string')
      : [];
  } catch {
    return [];
  }
}
