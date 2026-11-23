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
import { OwnStorePreview, loadOwnStorePreview } from '@/components/preview/OwnStorePreview';
import { BankDetailsCard } from './BankCard';
import type { Store, StoreSocialLinks, StoreTheme, WhatsAppSettings } from '@idevtenancy/shared';
import { StoreDesigner, type DesignerSeller } from '@/components/brand/StoreDesigner';
import { effectivePlan, hasFeature, planNameFor } from '@/lib/plans';
import '../../../styles/store-designer.css';
import { DomainCard, type DomainState } from './DomainCard';
import { dnsRecordsFor } from '@/lib/domains';
import { PlanUpsell } from '@/components/PlanUpsell';

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
  // Bank details for transfers (owner-only table; null before the migration).
  const { data: bankRow } = await sb
    .from('store_bank_accounts')
    .select('bank_name, account_name, account_number')
    .eq('store_id', s.id)
    .maybeSingle();
  const bank = bankRow
    ? { bankName: bankRow.bank_name as string, accountName: bankRow.account_name as string, accountNumber: bankRow.account_number as string }
    : null;
  const preview = await loadOwnStorePreview(sb, s, theme);
  // Custom domain (Emirates Plus); owner-readable row, null before the migration.
  const { data: domainRow } = await sb.from('store_domains').select('domain, status, note').eq('store_id', s.id).maybeSingle();
  const domain: DomainState | null = domainRow
    ? { domain: domainRow.domain as string, status: domainRow.status as DomainState['status'], note: (domainRow.note as string) ?? '', records: dnsRecordsFor(domainRow.domain as string) }
    : null;
  const plan = effectivePlan(s as unknown as { plan?: string | null; plan_expires_at?: string | null });
  const bg = theme?.background_color ?? '#FFFFFF';
  const hex = bg.replace('#', '');
  const lum = hex.length === 6 ? 0.2126 * parseInt(hex.slice(0, 2), 16) + 0.7152 * parseInt(hex.slice(2, 4), 16) + 0.0722 * parseInt(hex.slice(4, 6), 16) : 255;
  const designer: DesignerSeller = {
    layout: (theme?.layout ?? 'modern') as DesignerSeller['layout'],
    theme: {
      accent: theme?.accent_color ?? '#1456E0',
      accentSoft: theme?.accent_soft ?? '#3B82F6',
      accentText: theme?.accent_text ?? '#FFFFFF',
      bg,
      headingFont: `'${theme?.font_heading ?? 'Sora'}', 'Inter', sans-serif`,
      bodyFont: `'${theme?.font_body ?? 'Inter'}', system-ui, sans-serif`,
      heroStyle: (theme?.hero_style ?? 'gradient') as DesignerSeller['theme']['heroStyle'],
      dark: lum < 110,
      buttonShape: (['pill', 'rounded', 'square'].includes(String(theme?.button_shape)) ? theme?.button_shape : 'rounded') as DesignerSeller['theme']['buttonShape'],
    },
    templateLimit: plan.limits.templates,
    planName: plan.name,
  };
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
            {FEATURES.multiBranchTools || (plan.limits.locations ?? 2) > 1 ? (
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
            <div style={{ marginTop: 16 }}>
              <BankDetailsCard initial={bank} />
            </div>
            {hasFeature(s as unknown as { plan?: string | null; plan_expires_at?: string | null }, 'custom_domain', FEATURES.planGating) ? (
              <DomainCard initial={domain} storeSlug={s.slug} />
            ) : (
              <PlanUpsell title="Your own domain" planName={planNameFor('custom_domain')}>
                Put your store on your own address, like myshop.com, with {planNameFor('custom_domain')}.
              </PlanUpsell>
            )}
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
            <OwnStorePreview data={preview} />
            {/* The full store designer (20 templates + AI theme designer), saving to this store. */}
            <div className="dash-subsection" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Store designer</h3>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                Pick a template, describe a vibe for the AI, or tap a preset. Save, and your store page changes.
              </p>
              <StoreDesigner seller={designer} />
            </div>
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
              />
            )}
          </section>
        }
      />
    </main>
  );
}
