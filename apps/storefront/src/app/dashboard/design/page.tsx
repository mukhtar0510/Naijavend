// Look & feel (26 Nov 2026): the store's design in its own dashboard section,
// moved out of Settings. "Design my store with AI" first, then three short
// steps (logo, layout, colours), a live preview of the seller's real store and one Save button.
// Shop photos sit underneath. Owner only: staff are sent to the POS.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import type { Store, StoreTheme } from '@idevtenancy/shared';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { redirectStaffToPos } from '@/lib/staff';
import { effectivePlan } from '@/lib/plans';
import { FEATURES } from '@/lib/flags';
import { ThemeFonts } from '@/components/ThemeFonts';
import { loadOwnStorePreview } from '@/components/preview/OwnStorePreview';
import { GalleryCard } from '../settings/GalleryCard';
import { AppearanceCard } from '../settings/AppearanceCard';
import { DesignStudio, type StudioInitial } from './DesignStudio';
import '../../../styles/store-designer.css';
import '../../../styles/design-studio.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Look & feel' };

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function DesignPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin');
  await redirectStaffToPos(sb);
  const store = await getOwnStore<Store & { store_themes: StoreTheme[] | StoreTheme | null }>(sb, '*, store_themes(*)');
  if (!store) {
    return (
      <main>
        <h1>Look &amp; feel</h1>
        <p className="muted">Create your store first.</p>
      </main>
    );
  }
  const theme = one(store.store_themes);
  const plan = effectivePlan(store as unknown as { plan?: string | null; plan_expires_at?: string | null });
  const preview = await loadOwnStorePreview(sb, store, theme);
  const fontOr = (f: string | null | undefined, fallback: string) => (f && f.trim() ? f : fallback);

  const initial: StudioInitial = {
    storeName: store.name,
    area: preview.area,
    storeUrl: preview.storeUrl,
    products: preview.products.map((p) => ({ name: p.name, price: p.price, image: p.image ?? null })),
    logoUrl: theme?.logo_url ?? null,
    layout: (theme?.layout ?? 'modern') as StudioInitial['layout'],
    accent: theme?.accent_color ?? '#1D4ED8',
    accentSoft: theme?.accent_soft ?? '#3B82F6',
    accentText: theme?.accent_text ?? '#FFFFFF',
    bg: theme?.background_color ?? '#FFFFFF',
    headingFont: fontOr(theme?.font_heading, 'Sora'),
    bodyFont: fontOr(theme?.font_body, 'Inter'),
    heroStyle: (theme?.hero_style ?? 'gradient') as StudioInitial['heroStyle'],
    buttonShape: (['pill', 'rounded', 'square'].includes(String(theme?.button_shape)) ? theme?.button_shape : 'rounded') as StudioInitial['buttonShape'],
    templateLimit: plan.limits.templates,
    planName: plan.name,
  };
  const gallery = Array.isArray(theme?.gallery_urls) ? (theme!.gallery_urls as string[]) : [];

  return (
    <main className="ds-main">
      <ThemeFonts />
      <header className="ds-header">
        <div>
          <h1>Look &amp; feel</h1>
          <p className="dash-sub">How your store page looks to buyers. Change anything, check the preview, then save.</p>
        </div>
        <Link className="btn btn-outline btn-sm" href={preview.storeUrl} target="_blank" rel="noopener noreferrer">
          View my store <ExternalLink size={14} aria-hidden />
        </Link>
      </header>

      <DesignStudio initial={initial} />

      <section className="ds-card ds-photos" aria-labelledby="ds-photos-title">
        <div className="ds-step-head">
          <span className="ds-step-num" aria-hidden>
            4
          </span>
          <div>
            <h2 id="ds-photos-title">Shop photos</h2>
            <p>Photos of your shop, stall or team. They show on your store page. Saved on their own.</p>
          </div>
        </div>
        <GalleryCard initialGallery={gallery} />
      </section>

      {FEATURES.storefrontCustomisation && theme && (
        <details className="ds-card ds-advanced">
          <summary>Advanced styling (section colours, backgrounds, fonts)</summary>
          <AppearanceCard
            slug={store.slug}
            storeName={store.name}
            category={store.category}
            businessType={store.business_type}
            initialTheme={theme}
          />
        </details>
      )}
    </main>
  );
}
