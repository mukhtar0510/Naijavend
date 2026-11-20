'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RecentEntry {
  slug: string;
  name: string;
  logo: string | null;
}

const KEY = 'sf-recent';

/** Drops history entries whose store no longer exists (deleted or unpublished). */
export async function pruneRecentStores(items: RecentEntry[]): Promise<RecentEntry[]> {
  if (items.length === 0) return items;
  try {
    const res = await fetch(
      `/api/recent/validate?stores=${encodeURIComponent(items.map((i) => i.slug).join(','))}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return items;
    const data = (await res.json()) as { stores?: string[] };
    const live = new Set(data.stores ?? []);
    return items.filter((i) => live.has(i.slug));
  } catch {
    return items;
  }
}

function readHistory(): RecentEntry[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (e): e is RecentEntry =>
        !!e && typeof (e as RecentEntry).slug === 'string' && typeof (e as RecentEntry).name === 'string'
    );
  } catch {
    return [];
  }
}

// "Recently viewed" strip on the homepage — reads the local history recorded
// by store pages. Entries for stores that have since been deleted are dropped
// and removed from storage, so a dead store never shows up here.
export function RecentlyViewed() {
  const [items, setItems] = useState<RecentEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const history = readHistory();
    if (history.length === 0) {
      setLoaded(true);
      return;
    }
    void pruneRecentStores(history).then((live) => {
      if (cancelled) return;
      setItems(live);
      setLoaded(true);
      if (live.length !== history.length) {
        try {
          window.localStorage.setItem(KEY, JSON.stringify(live));
        } catch {
          // Storage unavailable — nothing else to clean up.
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="recent-viewed" aria-label="Recently viewed stores">
      <div className="recent-viewed-head">
        <h2>Recently viewed</h2>
      </div>
      <div className="recent-row">
        {items.map((e) => (
          <Link key={e.slug} href={`/s/${e.slug}`} className="card recent-card">
            {e.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
              <img src={e.logo} alt={`${e.name} logo`} />
            ) : (
              <span className="recent-initial" aria-hidden>{e.name.charAt(0).toUpperCase()}</span>
            )}
            <span className="recent-name">{e.name}</span>
            <span className="recent-visit">Visit again →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
