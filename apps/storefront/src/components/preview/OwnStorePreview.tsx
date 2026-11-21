// The seller's own store in the SitePreview frame (owner, 21 Nov 2026: it
// belongs in Settings > Look & feel, beside the controls that change it).
// Server component: reads the store's newest products itself.

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatNaira, type Store, type StoreTheme } from '@idevtenancy/shared';
import { SitePreview } from './SitePreview';
import { inIlorin, nearestArea } from '@/lib/ilorin';
import { siteUrl } from '@/lib/site';
import '../../styles/site-preview.css';

export async function OwnStorePreview({
  sb,
  store: s,
  theme,
}: {
  sb: SupabaseClient;
  store: Store & { announcement_starts_at?: string | null; announcement_ends_at?: string | null };
  theme: StoreTheme | null;
}) {
  const [{ data: newest }, { count }] = await Promise.all([
    sb.from('listings').select('title, price_kobo, image_urls').eq('store_id', s.id).order('created_at', { ascending: false }).limit(3),
    sb.from('listings').select('id', { count: 'exact', head: true }).eq('store_id', s.id),
  ]);
  const products = (newest ?? []).map((l) => ({
    name: String(l.title),
    price: formatNaira(Number(l.price_kobo)),
    image: ((l.image_urls as string[] | null) ?? [])[0] ?? null,
  }));
  const listingCount = count ?? products.length;
  const logo = theme?.logo_url ?? theme?.favicon_url ?? null;
  const nowIso = new Date().toISOString();
  const announcementLive =
    Boolean(s.announcement?.trim()) &&
    (!s.announcement_starts_at || s.announcement_starts_at <= nowIso) &&
    (!s.announcement_ends_at || s.announcement_ends_at >= nowIso);
  const area =
    s.latitude != null && s.longitude != null && inIlorin(Number(s.latitude), Number(s.longitude))
      ? `${nearestArea(Number(s.latitude), Number(s.longitude)).label}, Ilorin`
      : s.address?.trim() || null;
  const storeUrl = `${siteUrl().replace(/^https?:\/\//, '')}/s/${s.slug}`;

  return (
    <div className="dash-subsection dh-preview" style={{ marginBottom: 20 }}>
      <div className="dh-section-head">
        <h3 style={{ margin: 0, fontSize: 15 }}>Your store, as buyers see it</h3>
        <Link href={`/s/${s.slug}`} target="_blank" className="dh-more">
          Open live store <ExternalLink size={14} aria-hidden />
        </Link>
      </div>
      <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
        Save a change below, then reload to see it here.
      </p>
      <div className="dh-preview-body">
        <SitePreview
          label="Your store, live"
          url={storeUrl}
          name={s.name}
          logo={logo}
          verified={s.verification_status === 'verified'}
          area={area}
          hours={s.business_hours}
          promo={announcementLive ? { title: s.announcement!.trim() } : null}
          accent={theme?.accent_color ?? null}
          products={products}
          emptyProducts="Add products and they appear here"
          description={`Preview of your store page, ${s.name}`}
        />
        <ul className="dh-preview-tips">
          {listingCount < 3 && (
            <li>
              <Link href="/dashboard/listings/bulk">
                Add {3 - listingCount} more product{3 - listingCount === 1 ? '' : 's'}
              </Link>{' '}
              so the page looks full.
            </li>
          )}
          {!logo && <li>Add a logo below to replace the letters.</li>}
          {!announcementLive && <li>Add an announcement (Announcement tab) to show a banner like &ldquo;Weekend orders open&rdquo;.</li>}
          {!s.business_hours && <li>Set your hours (Business basics tab) so buyers see &ldquo;Open now&rdquo;.</li>}
          <li>
            Buyers see the real page at{' '}
            <Link href={`/s/${s.slug}`} target="_blank">
              {storeUrl}
            </Link>
            .
          </li>
        </ul>
      </div>
    </div>
  );
}
