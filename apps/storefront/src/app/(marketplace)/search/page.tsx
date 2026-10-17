import Link from 'next/link';
import { supabaseAnon } from '@/lib/supabase';
import { ProductCard, type ProductCardItem } from '@/components/ProductCard';
import { Stars } from '@/components/Stars';
import { embedText } from '@idevtenancy/ai';
import { parseSearchQuery } from '@/lib/search-terms';
import { isMissingColumn } from '@/lib/supabase';
import type { Store, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

const KINDS = new Set(['all', 'product', 'service', 'store']);

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; kind?: string };
}) {
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const kind = KINDS.has(searchParams.kind ?? '') ? (searchParams.kind as string) : 'all';

  // What the buyer actually asked for ("…under 15k in Lagos" → budget + city).
  const parsed = q ? parseSearchQuery(q) : null;
  const effectiveKind = kind === 'all' && parsed?.kind ? parsed.kind : kind;

  let products: ProductCardItem[] = [];
  let stores: Array<Store & { stats: StoreRatingStats | null; theme: StoreTheme | null }> = [];
  let semantic = false;
  let error: string | null = null;

  if (q && parsed) {
    try {
      const sb = supabaseAnon();
      const { budgetKobo, city, category } = parsed;
      const cityLc = city ? city.replace(/\s+/g, '') : null;
      const recallTerms = (parsed.terms.length ? parsed.terms : [q.toLowerCase()]).slice(0, 3);
      const esc = (t: string) => t.replace(/[%_]/g, (c) => `\\${c}`);

      // --- 1. Semantic recall (pgvector) -------------------------------
      // Both calls are best-effort: without the migration's vector columns or
      // a model key this stays empty and the query degrades to keyword recall.
      const vectorListingIds: { id: string; rank: number }[] = [];
      const vectorStoreIds: { id: string; rank: number }[] = [];
      const emb = await embedText(q);
      if (emb) {
        try {
          const [lm, sm] = await Promise.all([
            sb.rpc('match_listings', { query_embedding: emb, p_limit: 60 }),
            sb.rpc('match_stores', { query_embedding: emb, p_limit: 24 }),
          ]);
          if (!lm.error && Array.isArray(lm.data)) {
            vectorListingIds.push(...(lm.data as Array<{ id: string }>).map((r, i) => ({ id: String(r.id), rank: i })));
          }
          if (!sm.error && Array.isArray(sm.data)) {
            vectorStoreIds.push(...(sm.data as Array<{ id: string }>).map((r, i) => ({ id: String(r.id), rank: i })));
          }
          semantic = vectorListingIds.length > 0 || vectorStoreIds.length > 0;
        } catch {
          // vector extension absent — keyword recall below carries the search
        }
      }

      type ListingRow = Record<string, unknown> & {
        stores?: { name?: string; slug?: string; category?: string; address?: string | null } | null;
      };
      const listingById = new Map<string, ListingRow>();

      // --- 2. Keyword recall -------------------------------------------
      // One `or=` group per term in parallel. AND is applied by the scoring
      // pass below instead of in SQL, because a single mixed group would
      // silently drop every word except the first match.
      if (effectiveKind !== 'store') {
        // `category`/`tags` arrive with migration 20261017. If it has not been
        // pushed yet, drop down to the columns that already exist and keep the
        // search working — a pending migration must never blank the results.
        const SELECT_FULL = 'id, title, price_kobo, compare_at_kobo, type, category, tags, description, image_urls, stores!inner(name, slug, category, address)';
        const SELECT_BASE = 'id, title, price_kobo, compare_at_kobo, type, description, image_urls, stores!inner(name, slug, category, address)';
        // Once a missing column has been observed, skip straight to the base
        // select for the rest of this request (cheap memo, not a lock).
        let smartColumns = true;

        // Retry is keyed off WHICH SELECT the attempt used, not off shared
        // mutable state: the three recall queries run in parallel, so a global
        // "already retried" flag would let the losers of the race throw.
 const runOrThrow = async (
          build: (cols: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>,
          cols: string,
        ): Promise<ListingRow[]> => {
          const res = await build(cols);
          if (res.error && isMissingColumn(res.error) && cols === SELECT_FULL) {
            smartColumns = false;
            return runOrThrow(build, SELECT_BASE);
          }
          if (res.error) throw res.error;
          return (res.data ?? []) as ListingRow[];
        };
        const initialSelect = () => (smartColumns ? SELECT_FULL : SELECT_BASE);

        const recall = await Promise.all(
          recallTerms.map((t) => {
            const first = initialSelect();
            return runOrThrow(
              (cols) =>
                sb
                  .from('listings')
                  .select(cols)
                  .or(`title.ilike.%${esc(t)}%,description.ilike.%${esc(t)}%`)
                  .limit(40),
              first,
            );
          })
        );
        for (const rows of recall) {
          for (const row of rows) listingById.set(String(row.id), row);
        }
        // Bring back whatever the vector pass found so semantic hits could not
        // vanish under a keyword-only listing.
        const missing = vectorListingIds.map((v) => v.id).filter((id) => !listingById.has(id)).slice(0, 50);
        if (missing.length) {
          const first = initialSelect();
          const rows = await runOrThrow(
            (cols) => sb.from('listings').select(cols).in('id', missing),
            first,
          );
          for (const row of rows) listingById.set(String(row.id), row);
        }
      }

      const vectorRank = new Map(vectorListingIds.map((v) => [v.id, v.rank]));

      // --- 3. Score, filter, rank ---------------------------------------
      const scored = [...listingById.values()].map((row) => {
        const store = (row.stores ?? {}) as { name?: string; slug?: string; category?: string; address?: string | null };
        const priceKobo = Number(row.price_kobo) || 0;
        const titleLc = String(row.title).toLowerCase();
        const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
        const textLc = `${String(row.description ?? '')} ${tags.join(' ')}`.toLowerCase();
        const storeCat = String(store.category ?? '').toLowerCase();
        const listCat = String(row.category ?? '').toLowerCase();
        const addrLc = String(store.address ?? '').toLowerCase();

        let score = 0;
        parsed.terms.forEach((t, i) => {
          if (titleLc.includes(t)) score += 3 - i;
          else if (textLc.includes(t)) score += 1 - i * 0.2;
        });
        if (vectorRank.has(String(row.id))) score += 6 - vectorRank.get(String(row.id))! * 0.05;
        if (cityLc && addrLc.replace(/\s+/g, '').includes(cityLc)) score += 3;
        if (category && (listCat === category || storeCat === category)) score += 2.5;
        if (budgetKobo && priceKobo <= budgetKobo) score += 2;

        return { row, store, priceKobo, score };
      });

      const kept = scored.filter(({ row, store, priceKobo }) => {
        if (budgetKobo && priceKobo > budgetKobo) return false;
        if (category) {
          const listCat = String(row.category ?? '').toLowerCase();
          const storeCat = String(store.category ?? '').toLowerCase();
          if (listCat !== category && storeCat !== category) return false;
        }
        if (cityLc && !String(store.address ?? '').toLowerCase().replace(/\s+/g, '').includes(cityLc)) return false;
        if (effectiveKind === 'product' || effectiveKind === 'service' || effectiveKind === 'digital') {
          if (String(row.type) !== effectiveKind) return false;
        }
        return true;
      });

      products = kept
        .sort((a, b) => b.score - a.score)
        .slice(0, 24)
        .map(({ row, store, priceKobo }) => {
          const urls = (row.image_urls as string[] | null) ?? [];
          return {
            id: String(row.id),
            title: String(row.title),
            priceKobo,
            compareAtKobo: row.compare_at_kobo == null ? null : Number(row.compare_at_kobo),
            type: String(row.type),
            imageUrl: urls[0] ?? null,
            storeName: String(store.name ?? ''),
            storeSlug: String(store.slug ?? ''),
          };
        });

      // --- stores -------------------------------------------------------
      if (effectiveKind === 'all' || effectiveKind === 'store') {
        const byId = new Map<string, Record<string, unknown>>();
        const storeRecall = await Promise.all(
          recallTerms.slice(0, 2).map((t) =>
            sb.from('stores').select('*, store_rating_stats(review_count, avg_stars), store_themes(*)')
              .or(`name.ilike.%${esc(t)}%,description.ilike.%${esc(t)}%`)
              .limit(20)
          )
        );
        for (const r of storeRecall) {
          if (r.error) throw r.error;
          for (const row of (r.data ?? []) as Record<string, unknown>[]) byId.set(String(row.id), row);
        }
        if (vectorStoreIds.length) {
          const missing = vectorStoreIds.map((v) => v.id).filter((id) => !byId.has(id));
          if (missing.length) {
            const { data } = await sb.from('stores').select('*, store_rating_stats(review_count, avg_stars), store_themes(*)').in('id', missing);
            for (const row of (data ?? []) as Record<string, unknown>[]) byId.set(String(row.id), row);
          }
        }

        const storeRanks = new Map(vectorStoreIds.map((v) => [v.id, v.rank]));
        const scoredStores = [...byId.values()].map((row) => {
          const addrLc = String(row.address ?? '').toLowerCase().replace(/\s+/g, '');
          const nameLc = String(row.name ?? '').toLowerCase();
          let score = storeRanks.has(String(row.id)) ? 5 - storeRanks.get(String(row.id))! * 0.1 : 0;
          parsed.terms.forEach((t, i) => {
            if (nameLc.includes(t)) score += 3 - i;
            else if (String(row.description ?? '').toLowerCase().includes(t)) score += 1 - i * 0.2;
          });
          if (cityLc && addrLc.includes(cityLc)) score += 3;
          if (category && String(row.category ?? '').toLowerCase() === category) score += 2.5;
          return { row, score };
        });

        // Location/category filters apply only when they leave something to
        // show — a Lagos search must never end on an empty store list just
        // because every Lagos store left its address blank.
        const storeKept = scoredStores.filter(({ row }) => {
          if (cityLc && !String(row.address ?? '').toLowerCase().replace(/\s+/g, '').includes(cityLc)) return false;
          if (category && String(row.category ?? '').toLowerCase() !== category) return false;
          return true;
        });
        const storeRows = (storeKept.length ? storeKept : scoredStores)
          .sort((a, b) => b.score - a.score)
          .slice(0, 12)
          .map(({ row }) => row);

        stores = storeRows.map((s) => {
          const { store_rating_stats, store_themes, ...rest } = s as Record<string, unknown> & {
            store_rating_stats?: StoreRatingStats[] | StoreRatingStats;
            store_themes?: StoreTheme[] | StoreTheme;
          };
          return {
            ...(rest as unknown as Store),
            stats: one(store_rating_stats),
            theme: one(store_themes),
          };
        });
      }
    } catch (err) {
      console.error('[search] failed:', err);
      error = 'Search hit a snag — try again in a moment.';
    }
  }

  const nothing = q && products.length === 0 && stores.length === 0 && !error;

  return (
    <main>
      <div className="page-intro">
        <div className="container">
          <h1>{q ? `Results for “${q}”` : 'Search Naijavend'}</h1>
          <p>Products, services and stores — one search box.</p>
        </div>
      </div>      <div className="container" style={{ padding: '28px 20px' }}>
      {/* The search box itself — GET form, works without client JS. */}
      <form action="/search" method="get" className="searchbar" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search products, services or stores…"
          aria-label="Search Naijavend"
          maxLength={80}
        />
        <select name="kind" defaultValue={kind} aria-label="Search category">
          <option value="all">Everything</option>
          <option value="product">Products</option>
          <option value="service">Services</option>
          <option value="store">Stores</option>
        </select>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {!q && (
        <div className="card" style={{ marginTop: 18, maxWidth: 560 }}>
          <p style={{ margin: 0 }}>
            Try “cheap gift under 15k in Lagos”, “braids near me”, “ankara fabric” — or browse{' '}
            <Link href="/discover">all stores</Link>,{' '}
            <Link href="/rankings">top-ranked stores</Link>.
          </p>
        </div>
      )}

      {/* What we understood from the words the shopper typed — budget, city,
          category — so a filter they never asked for can be seen (and corrected). */}
      {q && parsed && parsed.notes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, alignItems: 'center' }} role="status">
          <span className="muted" style={{ fontSize: 13 }}>Reading your search as:</span>
          {parsed.notes.map((n) => (
            <span key={n} className="badge badge-blue" style={{ fontSize: 11.5 }}>{n}</span>
          ))}
          {semantic && <span className="badge" style={{ fontSize: 11.5 }}>✨ Semantic match</span>}
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginTop: 18 }}>{error}</div>}

      {nothing && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          Nothing matched “{q}”. Try a shorter word, or{' '}
          <Link href="/discover">browse all stores</Link>.
        </div>
      )}

      {stores.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <h2>Stores</h2>
          <div className="store-cards" style={{ marginTop: 14 }}>
            {stores.map((store) => {
              const logo = store.theme?.logo_url ?? store.theme?.favicon_url ?? null;
              return (
                <Link key={store.id} href={`/s/${store.slug}`} className="store-card">
                  <div
                    className="store-card-banner"
                    style={
                      (store.theme?.banner_url ?? store.theme?.subheader_url)
                        ? { backgroundImage: `url('${store.theme?.banner_url ?? store.theme?.subheader_url}')` }
                        : undefined
                    }
                  />
                  <div className="store-card-body">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                      <img className="store-card-logo" src={logo} alt="" />
                    ) : (
                      <div className="store-card-logo-fallback" style={{ background: 'var(--blue)' }}>
                        {store.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <h3>{store.name}</h3>
                      {store.is_dropshipper && <span className="badge badge-dropship" title="Ships from a supplier">🚚 Dropshipper</span>}
                    </div>
                    {store.stats && store.stats.review_count > 0 && (
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Stars value={Number(store.stats.avg_stars)} showNumeric={false} />
                        <span className="muted" style={{ fontSize: 13.5 }}>
                          {Number(store.stats.avg_stars).toFixed(1)} · {store.stats.review_count} reviews
                        </span>
                      </span>
                    )}
                    {store.address && <p className="store-card-addr">📍 {store.address}</p>}
                    <span className="store-card-visit">Visit store site →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <h2>{kind === 'service' ? 'Services' : kind === 'product' ? 'Products' : 'Products & services'}</h2>
          <div className="product-row" style={{ marginTop: 14 }}>
            {products.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
      </div>
    </main>
  );
}
