'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSavedSlugs, SAVED_EVENT } from '@/lib/saved';

export interface SavedCandidate {
  slug: string;
  name: string;
  category: string;
  logo: string | null;
}

// "Saved stores" row on /account — reads the local saved list and renders the
// matching stores from the server-provided index. Live-updates when hearts
// are toggled anywhere else in the app.
export function SavedStores({ stores }: { stores: SavedCandidate[] }) {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setSlugs(getSavedSlugs());
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SAVED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const saved = stores.filter((s) => slugs.includes(s.slug));

  return (
    <section className="saved-section" aria-label="Saved stores">
      <h2>♥ Saved stores</h2>
      {saved.length === 0 ? (
        <div className="empty-state">
          Nothing saved yet — tap the ♡ on any store card or store page to keep it here.
          <div style={{ marginTop: 12 }}>
            <Link href="/discover" className="btn btn-outline btn-sm">Browse stores</Link>
          </div>
        </div>
      ) : (
        <div className="saved-grid">
          {saved.map((s) => (
            <Link key={s.slug} href={`/s/${s.slug}`} className="card saved-card">
              {s.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                <img src={s.logo} alt={`${s.name} logo`} />
              ) : (
                <span className="saved-card-initial" aria-hidden>{s.name.charAt(0).toUpperCase()}</span>
              )}
              <span className="saved-card-name">{s.name}</span>
              <span className="badge">{s.category}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
