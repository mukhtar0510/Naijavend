import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { SettingsForm } from './SettingsForm';
import { AppearanceCard } from './AppearanceCard';
import { AnnouncementCard } from './AnnouncementCard';
import { SettingsTabs } from './SettingsTabs';
import { LocationsCard, type LocationRow } from './LocationsCard';
import { GalleryCard } from './GalleryCard';
import type { Store, StoreSocialLinks, StoreTheme, WhatsAppSettings } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

// Normalises PostgREST embeds: one-to-one comes back as an object, one-to-many as an array.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function SettingsPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too
  const store = await getOwnStore<
    Store & {
      whatsapp_settings: WhatsAppSettings[] | WhatsAppSettings | null;
      store_themes: StoreTheme[] | StoreTheme | null;
      social_links?: StoreSocialLinks | null;
    }
  >(sb, '*, whatsapp_settings(business_number, greeting_message, catalog_enabled), store_themes(*)');

  if (!store) {
    return <main><h1>Store settings</h1><p className="muted">Create your store first.</p></main>;
  }

  const s = store as unknown as Store & {
    whatsapp_settings: WhatsAppSettings[] | WhatsAppSettings | null;
    store_themes: StoreTheme[] | StoreTheme | null;
    social_links?: StoreSocialLinks | null;
    announcement_starts_at?: string | null;
    announcement_ends_at?: string | null;
  };
  const wa = one(s.whatsapp_settings);
  const theme = one(s.store_themes);

  // Branches (multi-location) + shop photo gallery.
  const { data: locationRows } = await sb
    .from('store_locations')
    .select('id, label, position, address, latitude, longitude, phone, note, business_hours')
    .eq('store_id', s.id)
    .order('position', { ascending: true });
  const locations = (locationRows ?? []) as unknown as LocationRow[];
  const gallery = Array.isArray(theme?.gallery_urls) ? (theme!.gallery_urls as string[]) : [];

  return (
    <main style={{ maxWidth: 780 }}>
      <h1>Store settings</h1>
      <p className="dash-sub">Everything about how your store presents to buyers.</p>

      <SettingsTabs
        business={
          <section className="dash-section" aria-label="Business basics" style={{ marginTop: 12 }}>
            <div className="dash-section-head">
              <h2>Business basics</h2>
              <span className="muted">Name, address, hours, WhatsApp</span>
            </div>
            <LocationsCard storeName={s.name} initialLocations={locations} />
            <SettingsForm
              store={{
                name: s.name,
                slug: s.slug,
                category: s.category,
                address: s.address,
                latitude: s.latitude,
                longitude: s.longitude,
                whatsapp_number: s.whatsapp_number,
                social_links: (s.social_links as Record<string, string> | null) ?? {},
                business_hours: (s.business_hours as Store['business_hours']) ?? null,
                announcement: s.announcement ?? null,
                delivery_info: s.delivery_info ?? null,
                is_dropshipper: s.is_dropshipper ?? false,
                dropship_info: s.dropship_info ?? null,
              }}
              whatsapp={wa ? { businessNumber: wa.business_number, greetingMessage: wa.greeting_message, catalogEnabled: wa.catalog_enabled } : null}
            />
          </section>
        }
        announcement={
          <section className="dash-section" aria-label="Announcement" style={{ marginTop: 12 }}>
            <div className="dash-section-head">
              <h2>Announcement</h2>
              <span className="muted">A banner on your store site — optionally scheduled</span>
            </div>
            <AnnouncementCard
              initial={s.announcement ?? ''}
              startsAt={s.announcement_starts_at ?? null}
              endsAt={s.announcement_ends_at ?? null}
            />
          </section>
        }
        appearance={
          <section className="dash-section" aria-label="Look and feel" style={{ marginTop: 12 }}>
            <div className="dash-section-head">
              <h2>Look &amp; feel</h2>
              <span className="muted">Colours, fonts, layout, images, favicon</span>
            </div>
            <GalleryCard initialGallery={gallery} />
            <AppearanceCard
              slug={s.slug}
              storeName={s.name}
              category={s.category}
              businessType={s.business_type}
              initialTheme={
                theme ?? {
                  store_id: s.id,
                  accent_color: '#1D4ED8',
                  accent_soft: '#3B82F6',
                  accent_text: '#FFFFFF',
                  font_heading: 'Sora',
                  font_body: 'Inter',
                  layout: 'modern',
                  hero_style: 'gradient',
                  banner_url: null,
                  favicon_url: null,
                  logo_url: null,
                  subheader_url: null,
                  background_color: '#FFFFFF',
                  text_color: null,
                  heading_color: null,
                  muted_color: null,
                  listing_color: null,
                  listing_bg_color: null,
                  card_radius: null,
                  listing_style: null,
                  hover_anim: null,
                  button_shape: 'rounded',
                  card_style: 'soft',
                  background_image_url: null,
                  background_image_style: null,
                  background_overlay: null,
                  background_gradient: null,
                  content_width: null,
                  hero_bg_color: null,
                  grid_bg_color: null,
                  footer_bg_color: null,
                  updated_at: new Date().toISOString(),
                }
              }
            />
          </section>
        }
      />
    </main>
  );
}
