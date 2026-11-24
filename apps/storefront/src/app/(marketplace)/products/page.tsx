// /products — every product and service from every Ilorin store on one page,
// with search, trade, type and price sorting. A plain GET form, so filters
// work without client JavaScript and every view has a shareable URL.
import Link from 'next/link';
import { STORE_CATEGORIES, categoryLabel } from '@idevtenancy/shared';
import { ChevronLeft, ChevronRight, Search, ShoppingBag } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { fetchListingFeed, type FeedSort, type FeedType } from '@/lib/listing-feed';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'All products',
  description: 'Products and services from every Ilorin store on Kwaravend, in one place.',
};

const PAGE = 36;
const SORTS: Array<{ value: FeedSort; label: string }> = [
  { value: 'new', label: 'Newest' },
  { value: 'price-asc', label: 'Lowest price' },
  { value: 'price-desc', label: 'Highest price' },
];
const TYPES: Array<{ value: FeedType; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'product', label: 'Products' },
  { value: 'service', label: 'Services' },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; type?: string; sort?: string; page?: string };
}) {
  const q = (searchParams.q ?? '').trim().slice(0, 60);
  const category = STORE_CATEGORIES.includes(searchParams.category as never) ? (searchParams.category as string) : '';
  const type: FeedType = TYPES.some((t) => t.value === searchParams.type) ? (searchParams.type as FeedType) : 'all';
  const sort: FeedSort = SORTS.some((s) => s.value === searchParams.sort) ? (searchParams.sort as FeedSort) : 'new';
  const page = Math.max(1, Math.min(200, Number.parseInt(searchParams.page ?? '1', 10) || 1));

  let items: Awaited<ReturnType<typeof fetchListingFeed>>['items'] = [];
  let total = 0;
  let failed = false;
  try {
    ({ items, total } = await fetchListingFeed({ q, category: category || undefined, type, sort, limit: PAGE, offset: (page - 1) * PAGE }));
  } catch (err) {
    console.error('[products] feed failed:', err);
    failed = true;
  }
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (category) sp.set('category', category);
    if (type !== 'all') sp.set('type', type);
    if (sort !== 'new') sp.set('sort', sort);
    if (p > 1) sp.set('page', String(p));
    const s = sp.toString();
    return `/products${s ? `?${s}` : ''}`;
  };
  const filtered = !!(q || category || type !== 'all');

  return (
    <main>
      <div className="page-intro">
        <div className="container">
          <h1>All products</h1>
          <p>
            Products and services from every store in Ilorin, in one place. <Link href="/tags">Browse by hashtag</Link>.
          </p>
        </div>
      </div>
      <div className="container" style={{ padding: '24px 20px 48px' }}>
        <form action="/products" method="get" className="prod-filters" role="search">
          <label className="prod-search">
            <Search size={17} aria-hidden />
            <span className="sr-only">Search products</span>
            <input type="search" name="q" defaultValue={q} placeholder="Search products and services" maxLength={60} enterKeyHint="search" />
          </label>
          <label>
            <span className="sr-only">Trade</span>
            <select name="category" defaultValue={category}>
              <option value="">All trades</option>
              {STORE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Type</span>
            <select name="type" defaultValue={type}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort</span>
            <select name="sort" defaultValue={sort}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary">
            Show
          </button>
        </form>

        <p className="prod-count" aria-live="polite">
          {failed
            ? 'Products could not load. Try again in a moment.'
            : `${total} ${total === 1 ? 'item' : 'items'}${q ? ` matching “${q}”` : ''}${category ? ` in ${categoryLabel(category)}` : ''}`}
          {filtered && (
            <>
              {' · '}
              <Link href="/products">Clear filters</Link>
            </>
          )}
        </p>

        {!failed && items.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 16 }}>
            <ShoppingBag className="ico-inline" aria-hidden />{' '}
            {filtered ? 'Nothing matches these filters. Try fewer words or another trade.' : 'No products yet. New stores add items every week.'}
          </div>
        ) : (
          <div className="prod-grid">
            {items.map((it) => (
              <ProductCard
                key={it.id}
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
                  hasVideo: !!it.video,
                  tags: it.tags,
                }}
              />
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav className="prod-pager" aria-label="Pages">
            {page > 1 ? (
              <Link className="btn btn-outline btn-sm" href={href(page - 1)} rel="prev">
                <ChevronLeft size={15} aria-hidden /> Previous
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link className="btn btn-outline btn-sm" href={href(page + 1)} rel="next">
                Next <ChevronRight size={15} aria-hidden />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  );
}
