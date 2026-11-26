import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { redirectStaffToPos } from '@/lib/staff';
import { SettingsForm } from './SettingsForm';
import { FEATURES } from '@/lib/flags';
import { AnnouncementCard } from './AnnouncementCard';
import { SettingsTabs } from './SettingsTabs';
import { ThemeSetting } from '@/components/ThemeSetting';
import { LocationsCard, type LocationRow } from './LocationsCard';
import { BankDetailsCard } from './BankCard';
import type { Store, StoreSocialLinks, StoreTheme, WhatsAppSettings } from '@idevtenancy/shared';
import { effectivePlan, hasFeature, planNameFor } from '@/lib/plans';
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
  // Look & feel moved to its own section (26 Nov 2026); keep old links working.
  if (tab === 'appearance') redirect('/dashboard/design');
  const initialTab = tab === 'announcement' ? tab : 'business';
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
  // Custom domain (Emirates Plus); owner-readable row, null before the migration.
  const { data: domainRow } = await sb.from('store_domains').select('domain, status, note').eq('store_id', s.id).maybeSingle();
  const domain: DomainState | null = domainRow
    ? { domain: domainRow.domain as string, status: domainRow.status as DomainState['status'], note: (domainRow.note as string) ?? '', records: dnsRecordsFor(domainRow.domain as string) }
    : null;
  const plan = effectivePlan(s as unknown as { plan?: string | null; plan_expires_at?: string | null });

  return (
    <main style={{ maxWidth: 780 }}>
      <h1>Store settings</h1>
      <p className="dash-sub">
        Your business details, payments and announcement. To change how your store looks, open{' '}
        <Link href="/dashboard/design">Look &amp; feel</Link>.
      </p>

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
            {/* How the dashboard itself looks (not the store page). */}
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Dashboard theme</h3>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                Only changes how Kwaravend looks while you&apos;re signed in. Your store&apos;s design is in{' '}
                <Link href="/dashboard/design">Look &amp; feel</Link>.
              </p>
              <ThemeSetting />
            </div>
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
      />
    </main>
  );
}
