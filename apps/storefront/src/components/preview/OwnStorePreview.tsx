// The seller's own store in the SitePreview frame (owner, 21 Nov 2026: it
// belongs in Settings > Look & feel, beside the controls that change it).
// loadOwnStorePreview() reads the data on the server; <OwnStorePreview> is a
// plain component (no async component, so every React types version accepts it).

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatNaira, type BusinessHours, type Store, type StoreTheme } from '@idevtenancy/shared';
import { SitePreview, type SitePreviewProduct } from './SitePreview';
import { inIlorin, nearestArea } from '@/lib/ilorin';
import { siteUrl } from '@/lib/site';
import '../../styles/site-preview.css';

export interface OwnStorePreviewData {
  slug: string;
  name: string;
  logo: string | null;
  verified: boolean;
  area: string | null;
  hours: BusinessHours | null;
  announcement: string | null;
  accent: string | null;
  products: SitePreviewProduct[];
  listingCount: number;
  storeUrl: string;
}

export async function loadOwnStorePreview(
  sb: SupabaseClient,
  s: Store & { announcement_starts_at?: string | null; announcement_ends_at?: string | null },
  theme: StoreTheme | null,
): Promise<OwnStorePreviewData> {
  const [{ data: newest }, { count }] = await Promise.all([
    sb.from('listings').select('title, price_kobo, image_urls').eq('store_id', s.id).order('created_at', { ascending: false }).limit(3),
    sb.from('listings').select('id', { count: 'exact', head: true }).eq('store_id', s.id),
  ]);
  const products = (newest ?? []).map((l) => ({
    name: String(l.title),
    price: formatNaira(Number(l.price_kobo)),
    image: ((l.image_urls as string[] | null) ?? [])[0] ?? null,
  }));
  const nowIso = new Date().toISOString();
  const announcementLive =
    Boolean(s.announcement?.trim()) &&
    (!s.announcement_starts_at || s.announcement_starts_at <= nowIso) &&
    (!s.announcement_ends_at || s.announcement_ends_at >= nowIso);
  return {
    slug: s.slug,
    name: s.name,
    logo: theme?.logo_url ?? theme?.favicon_url ?? null,
    verified: s.verification_status === 'verified',
    area:
      s.latitude != null && s.longitude != null && inIlorin(Number(s.latitude), Number(s.longitude))
        ? `${nearestArea(Number(s.latitude), Number(s.longitude)).label}, Ilorin`
        : s.address?.trim() || null,
    hours: s.business_hours ?? null,
    announcement: announcementLive ? s.announcement!.trim() : null,
    accent: theme?.accent_color ?? null,
    products,
    listingCount: count ?? products.length,
    storeUrl: `${siteUrl().replace(/^https?:\/\//, '')}/s/${s.slug}`,
  };
}

export function OwnStorePreview({ data: d }: { data: OwnStorePreviewData }) {
  return (
    <div className="dash-subsection dh-preview" style={{ marginBottom: 20 }}>
      <div className="dh-section-head">
        <h3 style={{ margin: 0, fontSize: 15 }}>Your store, as buyers see it</h3>
        <Link href={`/s/${d.slug}`} target="_blank" className="dh-more">
          Open live store <ExternalLink size={14} aria-hidden />
        </Link>
      </div>
      <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
        Save a change below, then reload to see it here.
      </p>
      <div className="dh-preview-body">
        <SitePreview
          label="Your store, live"
          url={d.storeUrl}
          name={d.name}
          logo={d.logo}
          verified={d.verified}
          area={d.area}
          hours={d.hours}
          promo={d.announcement ? { title: d.announcement } : null}
          accent={d.accent}
          products={d.products}
          emptyProducts="Add products and they appear here"
          description={`Preview of your store page, ${d.name}`}
        />
        <ul className="dh-preview-tips">
          {d.listingCount < 3 && (
            <li>
              <Link href="/dashboard/listings/bulk">
                Add {3 - d.listingCount} more product{3 - d.listingCount === 1 ? '' : 's'}
              </Link>{' '}
              so the page looks full.
            </li>
          )}
          {!d.logo && <li>Add a logo below to replace the letters.</li>}
          {!d.announcement && <li>Add an announcement (Announcement tab) to show a banner like &ldquo;Weekend orders open&rdquo;.</li>}
          {!d.hours && <li>Set your hours (Business basics tab) so buyers see &ldquo;Open now&rdquo;.</li>}
          <li>
            Buyers see the real page at{' '}
            <Link href={`/s/${d.slug}`} target="_blank">
              {d.storeUrl}
            </Link>
            .
          </li>
        </ul>
      </div>
    </div>
  );
}
