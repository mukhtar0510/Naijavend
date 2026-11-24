// /tags — every hashtag in use, hottest first (lib/trending.ts). Tags marked
// "on heat" got most of their attention in the last 48 hours.
import Link from 'next/link';
import { Flame } from 'lucide-react';
import { getTrending } from '@/lib/trending';

export const revalidate = 300;
export const metadata = {
  title: 'Hashtags',
  description: 'Trending hashtags on Kwaravend listings in Ilorin.',
};

export default async function TagsPage() {
  const { tags } = await getTrending();
  const hot = tags.filter((t) => t.onHeat);
  return (
    <main>
      <div className="page-intro">
        <div className="container">
          <h1>Hashtags</h1>
          <p className="muted">
            Hottest first, from what buyers are viewing and ordering this week. Tap one to see every listing with it.
          </p>
        </div>
      </div>
      <div className="container" style={{ padding: '24px 20px 48px' }}>
        {tags.length === 0 ? (
          <div className="empty-state">
            Sellers have not added hashtags yet. <Link href="/products">Browse all products</Link>.
          </div>
        ) : (
          <>
            {hot.length > 0 && (
              <section aria-label="On heat" style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Flame size={17} aria-hidden /> On heat
                </h2>
                <ul className="kv-trend-tags" style={{ listStyle: 'none', padding: 0 }}>
                  {hot.map((t) => (
                    <li key={t.tag}>
                      <Link className="kv-trend-chip is-hot" href={`/tags/${t.tag}`}>
                        #{t.tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <h2 style={{ fontSize: 17 }}>All hashtags</h2>
            <ul className="kv-trend-tags" style={{ listStyle: 'none', padding: 0 }}>
              {tags.slice(0, 120).map((t) => (
                <li key={t.tag}>
                  <Link className={`kv-trend-chip${t.onHeat ? ' is-hot' : ''}`} href={`/tags/${t.tag}`}>
                    #{t.tag} <span className="muted">{t.listings}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
