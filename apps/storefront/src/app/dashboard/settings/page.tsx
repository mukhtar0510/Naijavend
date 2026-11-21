import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { redirectStaffToPos } from '@/lib/staff';
import { ThemeFonts } from '@/components/ThemeFonts';
import { SettingsForm } from './SettingsForm';
import { AppearanceCard } from './AppearanceCard';
import { SimpleBrandCard } from './SimpleBrandCard';
import { FEATURES } from '@/lib/flags';
import { AnnouncementCard } from './AnnouncementCard';
import { SettingsTabs } from './SettingsTabs';
import { ThemeSetting } from '@/components/ThemeSetting';
import { LocationsCard, type LocationRow } from './LocationsCard';
import { GalleryCard } from './GalleryCard';
import { OwnStorePreview } from '@/components/preview/OwnStorePreview';
import type { Store, StoreSocialLinks, StoreTheme, WhatsAppSettings } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

// Normalises PostgREST embeds: one-to-one comes back as an object, one-to-many as an array.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function SettingsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const tab = searchParams?.tab;
  const initialTab = tab === 'appearance' || tab === 'announcement' ? tab : 'business';
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too
  await redirectStaffToPos(sb); // R4: settings are owner-only
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
      {/* The appearance editors preview seller-chosen theme fonts. */}
      <ThemeFonts />
      <h1>Store settings</h1>
      <p className="dash-sub">Everything about how your store presents to buyers.</p>

      <SettingsTabs
        initial={initialTab}
        business={
          <section className="dash-section" aria-label="Business basics" style={{ marginTop: 12 }}>
            <div className="dash-section-head">
              <h2>Business basics</h2>
              <span className="muted">Name, address, hours, WhatsApp</span>
            </div>
            {FEATURES.multiBranchTools ? (
              <LocationsCard storeName={s.name} initialLocations={locations} />
            ) : null}
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
                delivery_options: (s as unknown as { delivery_options?: Record<string, { enabled: boolean; fee_kobo: number }> | null }).delivery_options ?? null,
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
              <span className="muted">Logo, accent colour and template</span>
            </div>
            {/* The live store preview sits with the controls that change it. */}
            <OwnStorePreview sb={sb} store={s} theme={theme} />
            {/* App UI theme — separate from the storefront branding below. */}
            <div className="dash-subsection" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Your dashboard theme</h3>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                Only changes how Kwaravend looks while you&apos;re signed in — your storefront keeps its own colours.
              </p>
              <ThemeSetting />
            </div>
            <GalleryCard initialGallery={gallery} />
            {FEATURES.storefrontCustomisation ? (
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
            ) : (
              <SimpleBrandCard
                slug={s.slug}
                initialLogoUrl={theme?.logo_url ?? null}
                initialAccent={theme?.accent_color ?? '#1D4ED8'}
                initialLayout={theme?.layout ?? 'modern'}
                initialButtonShape={(theme?.button_shape as 'pill' | 'rounded' | 'square' | undefined) ?? 'rounded'}
              />
            )}
          </section>
        }
      />
    </main>
  );
}
