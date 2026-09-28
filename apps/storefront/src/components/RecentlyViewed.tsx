'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RecentEntry {
  slug: string;
  name: string;
  logo: string | null;
}

const KEY = 'sf-recent';

// "Recently viewed" strip on the homepage — reads the local history recorded
// by store pages. Renders nothing until there is history.
export function RecentlyViewed() {
  const [items, setItems] = useState<RecentEntry[]>([]);

  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
      if (Array.isArray(raw)) {
        setItems(
          raw.filter(
            (e): e is RecentEntry =>
              !!e && typeof (e as RecentEntry).slug === 'string' && typeof (e as RecentEntry).name === 'string'
          )
        );
      }
    } catch {
      // Ignore malformed history.
    }
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="recent-viewed" style={{ marginTop: 48 }} aria-label="Recently viewed stores">
      <h2>👀 Recently viewed</h2>
      <div className="recent-row" style={{ marginTop: 14 }}>
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
