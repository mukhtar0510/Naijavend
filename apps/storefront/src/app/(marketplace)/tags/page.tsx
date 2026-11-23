// /tags — the hashtags sellers use most, each linking to its ranked listings.
import Link from 'next/link';
import { popularHashtags } from '@/lib/hashtags';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Hashtags',
  description: 'Popular hashtags on Kwaravend listings in Ilorin.',
};

export default async function TagsPage() {
  const tags = await popularHashtags(60);
  return (
    <main>
      <div className="page-intro">
        <div className="container">
          <h1>Hashtags</h1>
          <p className="muted">Tap a hashtag to see every listing with it, best sellers first.</p>
        </div>
      </div>
      <div className="container" style={{ padding: '24px 20px 48px' }}>
        {tags.length === 0 ? (
          <div className="empty-state">
            Sellers have not added hashtags yet. <Link href="/products">Browse all products</Link>.
          </div>
        ) : (
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
            {tags.map((t) => (
              <li key={t.tag}>
                <Link className="badge" href={`/tags/${t.tag}`} style={{ fontSize: 14, padding: '6px 12px' }}>
                  #{t.tag} <span className="muted">{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
