import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { siteUrl } from '@/lib/site';
import { formatNaira } from '@idevtenancy/shared';
import { ListingEditor } from './ListingEditor';
import { DiscountManager, type DiscountRow } from './DiscountManager';
import { ListingQrManager } from './ListingQrManager';
import type { Listing, Store } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

// Delete results come back as ?remove=… flags from /api/listings/delete.
const REMOVE_MESSAGES: Record<string, string> = {
  deleted: 'Listing removed.',
  'has-orders': "Can't remove — this listing is part of one or more orders (history must stay intact). You can set its stock to 0 instead.",
  invalid: 'That listing could not be found — refresh and try again.',
  error: 'Something went wrong removing the listing. Try again.',
};

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ remove?: string }> }) {
  const { remove } = await searchParams;
  const sb = await getSellerClient();
  // The layout also redirects, but layout and page render in parallel — without
  // this guard an expired session crashes this page (sb!.auth on null) with a
  // 500 before the layout's redirect lands. Looked like "listing not saving".
  if (!sb) redirect('/dashboard/signin');
  const store = await getOwnStore<Store>(sb);
  if (!store) {
    return (
      <main>
        <h1>Listings</h1>
        <p className="muted">Create your store first.</p>
        <Link href="/dashboard/onboarding" className="btn btn-primary">Set up my store</Link>
      </main>
    );
  }

  const { data: listings } = await sb.from('listings').select('*').eq('store_id', (store as Store).id).order('created_at', { ascending: false });
  const { data: promoRows } = await sb.from('discount_codes').select('id, code, percent_off, active, usage_count, max_uses').eq('store_id', (store as Store).id).order('created_at', { ascending: false });

  return (
    <main>
      <h1>Listings</h1>

      {remove && REMOVE_MESSAGES[remove] && (
        <div className={`alert ${remove === 'deleted' ? 'alert-success' : 'alert-error'}`} role="status">
          {REMOVE_MESSAGES[remove]}
        </div>
      )}
      <p className="muted">Products get ordered; services get booked as appointments.</p>

      {(listings as Listing[] | null)?.length ? (
        <div style={{ display: 'grid', gap: 10, marginBottom: 32 }}>
          {(listings as Listing[]).map((l) => {
            const cover = (l.image_urls ?? []).find((u) => typeof u === 'string' && /^https?:\/\//.test(u)) ?? null;
            return (
            <div key={l.id} className="card dash-listing-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                  <img className="dash-listing-thumb" src={cover} alt="" />
                ) : (
                  <div className="dash-listing-thumb" aria-hidden>{l.type === 'service' ? '📅' : '🛍️'}</div>
                )}
                <div style={{ minWidth: 0 }}>
                  <strong>{l.title}</strong>{' '}
                  <span className="badge badge-blue">{l.type}</span>
                  {(l.image_urls?.length ?? 0) > 0 && (
                    <span className="badge" style={{ marginLeft: 4 }}>🖼 {l.image_urls.length}</span>
                  )}
                  <p className="muted mono" style={{ margin: '4px 0 0', fontSize: 14 }}>
                    {formatNaira(l.price_kobo)}
                    {l.compare_at_kobo != null && l.compare_at_kobo > l.price_kobo && (
                      <> <span className="product-badge badge-sale">Sale</span></>
                    )}
                    {l.type === 'product' && l.stock === 0 && (
                      <> <span className="product-badge badge-soldout">Sold out</span></>
                    )}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Link className="btn btn-outline btn-sm" href={`/s/${(store as Store).slug}/listing/${l.id}`} target="_blank">
                  Preview ↗
                </Link>
                <form action={`/api/listings/delete`} method="post">
                  <input type="hidden" name="listingId" value={l.id} />
                  <button className="btn btn-outline btn-sm" type="submit">Remove</button>
                </form>
              </div>
            </div>
            );
          })}
          <ListingQrManager
            items={(listings as Listing[]).map((l) => ({
              id: l.id,
              title: l.title,
              storeSlug: (store as Store).slug,
              storeName: (store as Store).name,
              siteUrl: siteUrl(),
            }))}
          />
        </div>
      ) : (
        <div className="empty-state" style={{ marginBottom: 32 }}>
          Nothing listed yet — add your first product or service below.
        </div>
      )}

      <h2>Add a listing</h2>
      <ListingEditor storeId={(store as Store).id} />

      <div style={{ marginTop: 28 }}>
        <DiscountManager initial={(promoRows ?? []) as DiscountRow[]} />
      </div>
    </main>
  );
}
