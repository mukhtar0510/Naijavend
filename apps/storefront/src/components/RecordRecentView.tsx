'use client';

import { useEffect } from 'react';

// Records a store view into localStorage ("sf-recent") so the homepage can
// show a "Recently viewed" strip. Local to this browser; renders nothing.
const KEY = 'sf-recent';
const MAX = 8;

export function RecordRecentView({ slug, name, logo }: { slug: string; name: string; logo: string | null }) {
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
      const list = Array.isArray(raw) ? raw : [];
      const entry = { slug, name, logo };
      const next = [entry, ...list.filter((e) => (e as { slug?: string })?.slug !== slug)].slice(0, MAX);
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable — silently skip.
    }
  }, [slug, name, logo]);

  return null;
}
