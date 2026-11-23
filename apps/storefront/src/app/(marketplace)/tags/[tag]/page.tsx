// /tags/<tag> — every listing with one hashtag, best sellers first. Hashtags
// are set by sellers (or suggested by the AI) in the listing editor.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Hash, ShoppingBag } from 'lucide-react';
import { normaliseHashtag } from '@idevtenancy/shared';
import { ProductCard } from '@/components/ProductCard';
import { fetchTaggedListings } from '@/lib/hashtags';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { tag: string } }): Metadata {
  const tag = normaliseHashtag(decodeURIComponent(params.tag));
  return {
    title: tag ? `#${tag}` : 'Hashtag',
    description: tag ? `Listings tagged #${tag} from Ilorin stores on Kwaravend, best sellers first.` : undefined,
  };
}

export default async function TagPage({ params }: { params: { tag: string } }) {
  const raw = decodeURIComponent(params.tag);
  const tag = normaliseHashtag(raw);
  if (!tag) notFound();
  if (tag !== raw) redirect(`/tags/${tag}`);

  const { items } = await fetchTaggedListings(tag);
  const anySold = items.some((i) => i.sold > 0);

  return (
    <main>
      <div className="page-intro">
        <div className="container">
          <h1>
            <Hash className="ico-inline" aria-hidden />
            {tag}
          </h1>
          <p className="muted">
            {items.length === 0
              ? 'No listings carry this hashtag yet.'
              : `${items.length} ${items.length === 1 ? 'listing' : 'listings'}${anySold ? ', best sellers first' : ', newest first'}.`}
          </p>
        </div>
      </div>
      <div className="container" style={{ padding: '24px 20px 48px' }}>
        {items.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag className="ico-inline" aria-hidden /> Nothing here yet.{' '}
            <Link href="/tags">See popular hashtags</Link> or <Link href="/products">browse all products</Link>.
          </div>
        ) : (
          <ol className="prod-grid" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map((it, i) => (
              <li key={it.id} style={{ position: 'relative' }}>
                {anySold && it.sold > 0 && (
                  <span className="badge" style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
                    #{i + 1} · {it.sold} sold
                  </span>
                )}
                <ProductCard
                  item={{
                    id: it.id,
                    title: it.title,
                    priceKobo: it.priceKobo,
                    compareAtKobo: it.compareAtKobo,
                    stock: it.stock,
                    type: it.type,
                    imageUrl: it.cover,
                    storeName: it.isExample ? `${it.storeName} (Example)` : it.storeName,
                    storeSlug: it.storeSlug,
                    hasVideo: it.hasVideo,
                  }}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
