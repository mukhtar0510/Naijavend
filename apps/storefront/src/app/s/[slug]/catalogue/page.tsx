import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAnon } from '@/lib/supabase';
import { formatNaira, categoryEmoji } from '@idevtenancy/shared';
import type { Listing, Store } from '@idevtenancy/shared';

export const revalidate = 60; // ISR — static-fast, invalidated on seller writes via revalidatePath

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const { data: store } = await supabaseAnon().from('stores').select('name').eq('slug', params.slug).maybeSingle();
    return { title: store?.name ? `${store.name} — Catalogue` : 'Catalogue' };
  } catch {
    return { title: 'Catalogue' };
  }
}



export default async function CataloguePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { type?: string };
}) {
  const sb = supabaseAnon();
  const { data: store } = await sb.from('stores').select('id, name, slug, business_type').eq('slug', params.slug).maybeSingle();
  if (!store) notFound();
  const s = store as Pick<Store, 'id' | 'name' | 'slug' | 'business_type'>;

  const typeFilter = searchParams.type === 'product' || searchParams.type === 'service' ? searchParams.type : undefined;
  let query = sb.from('listings').select('*').eq('store_id', s.id).order('created_at', { ascending: false }).limit(200);
  if (typeFilter) query = query.eq('type', typeFilter);
  const { data: listings } = await query;
  const items = (listings as Listing[] | null) ?? [];

  const hasProducts = s.business_type !== 'service';
  const hasServices = s.business_type !== 'product';

  return (
    <main>
      <div className="container" style={{ padding: '28px 20px' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: 14 }}>
          <Link href={`/s/${s.slug}`} className="muted">← Back to {s.name}</Link>
        </nav>
        <h1 style={{ marginBottom: 6 }}>Catalogue</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          Everything {s.name} offers — tap any item for photos, details and ordering.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <Link href={`/s/${s.slug}/catalogue`} className={`badge ${!typeFilter ? 'badge-black' : ''}`}>All</Link>
          {hasProducts && (
            <Link href={`/s/${s.slug}/catalogue?type=product`} className={`badge ${typeFilter === 'product' ? 'badge-black' : ''}`}>
              🛒 Products
            </Link>
          )}
          {hasServices && (
            <Link href={`/s/${s.slug}/catalogue?type=service`} className={`badge ${typeFilter === 'service' ? 'badge-black' : ''}`}>
              📅 Services
            </Link>
          )}
        </div>

        {items.length === 0 ? (
          <div className="empty-state">Nothing here yet — check back soon.</div>
        ) : (
          <div className="catalogue-grid">
            {items.map((listing) => {
              const cover = (listing.image_urls ?? []).find((u) => typeof u === 'string' && /^https?:\/\//.test(u)) ?? null;
              return (
                <Link key={listing.id} href={`/s/${s.slug}/listing/${listing.id}`} className="card catalogue-card">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                    <img className="catalogue-cover" src={cover} alt={listing.title} loading="lazy" decoding="async" />
                  ) : (
                    <div className="catalogue-cover-fallback" aria-hidden>
                      {categoryEmoji('general')}
                    </div>
                  )}
                  <span className={`badge ${listing.type === 'service' ? '' : 'badge-blue'}`}>
                    {listing.type === 'service' ? 'Service' : 'Product'}
                  </span>
                  <h3>{listing.title}</h3>
                  <span className="price">{formatNaira(listing.price_kobo)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
