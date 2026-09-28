import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAnon } from '@/lib/supabase';
import '../../../styles/base.css';
import '../../../styles/chrome.css';
import '../../../styles/components.css';
import '../../../styles/interactions.css';
import { TrackStoreView } from '@/components/TrackStoreView';
import { OpenBadge } from '@/components/OpenBadge';
import { BackToMarket } from '@/components/BackToMarket';
import { InstagramIcon, XIcon, FacebookIcon, TikTokIcon, YouTubeIcon } from '@/components/SocialIcons';
import type { StoreSocialLinks, StoreTheme } from '@idevtenancy/shared';

const SOCIAL_META: Array<{ key: keyof StoreSocialLinks; label: string; Icon: (p: { size?: number }) => React.ReactNode; prefix: string }> = [
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon, prefix: 'https://instagram.com/' },
  { key: 'twitter', label: 'X (Twitter)', Icon: XIcon, prefix: 'https://x.com/' },
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon, prefix: 'https://facebook.com/' },
  { key: 'tiktok', label: 'TikTok', Icon: TikTokIcon, prefix: 'https://tiktok.com/@' },
  { key: 'youtube', label: 'YouTube', Icon: YouTubeIcon, prefix: 'https://youtube.com/@' },
];

function SocialRow({ links, storeName }: { links: StoreSocialLinks | null; storeName: string }) {
  if (!links) return null;
  const entries = SOCIAL_META.filter((m) => links[m.key]);
  if (entries.length === 0) return null;
  return (
    <div className="social-row">
      {entries.map((m) => {
        const handle = links[m.key] as string;
        const href = m.prefix ? (handle.startsWith('http') ? handle : `${m.prefix}${handle.replace(/^@/, '')}`) : handle;
        return (
          <a
            key={m.key}
            className="social-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${storeName} on ${m.label}`}
            title={m.label}
          >
            <m.Icon size={16} />
          </a>
        );
      })}
    </div>
  );
}

const DEFAULTS = {
  accent_color: '#1D4ED8',
  accent_soft: '#3B82F6',
  accent_text: '#FFFFFF',
  background_color: '#FFFFFF',
  font_heading: 'Sora',
  font_body: 'Inter',
  button_shape: 'rounded',
  card_style: 'soft',
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { slug } = params;
  try {
    const sb = supabaseAnon();
    const { data: store } = await sb.from('stores').select('id, name').eq('slug', slug).maybeSingle();
    if (!store) return { title: 'Store' };
    const { data: theme } = await sb
      .from('store_themes')
      .select('favicon_url, accent_color')
      .eq('store_id', store.id)
      .maybeSingle();

    const icons: Metadata['icons'] = {};
    if (theme?.favicon_url) icons.icon = String(theme.favicon_url);
    return {
      title: store.name ?? 'Store',
      ...(Object.keys(icons).length ? { icons } : {}),
    };
  } catch {
    return { title: 'Store' };
  }
}

// Independent store-site shell: every /s/* page renders as the seller's OWN website —
// its own masthead, navigation and footer — styled with the theme they picked in
// dashboard settings, with Naijavend only as a quiet platform badge.
export default async function StoreSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const { slug } = params;
  const sb = supabaseAnon();
  const { data: store } = await sb
    .from('stores')
    .select('id, name, slug, description, social_links, business_hours, announcement, is_dropshipper')
    .eq('slug', slug)
    .maybeSingle();
  if (!store) notFound();
  const s = store as {
    description: string | null;
    social_links: StoreSocialLinks | null;
    business_hours: import('@idevtenancy/shared').BusinessHours | null;
    announcement: string | null;
    is_dropshipper: boolean | null;
  };
  const socials = s.social_links ?? null;

  const [{ data: wa }, { data: themeRow }] = await Promise.all([
    sb.from('whatsapp_settings').select('business_number').eq('store_id', store.id).maybeSingle(),
    sb.from('store_themes').select('*').eq('store_id', store.id).maybeSingle(),
  ]);
  const t = (themeRow ?? null) as StoreTheme | null;
  const waNumber = (wa?.business_number as string | undefined) ?? undefined;

  const brandLogo = t?.logo_url ?? t?.favicon_url ?? null;

  // The chosen theme overrides the Naijavend design tokens inside this store site.
  const themeStyle = {
    '--st-accent': t?.accent_color ?? DEFAULTS.accent_color,
    '--st-accent-soft': t?.accent_soft ?? DEFAULTS.accent_soft,
    '--st-accent-text': t?.accent_text ?? DEFAULTS.accent_text,
    '--st-bg': t?.background_color ?? DEFAULTS.background_color,
    '--st-font-heading': `'${t?.font_heading ?? DEFAULTS.font_heading}', 'Inter', sans-serif`,
    '--st-font-body': `'${t?.font_body ?? DEFAULTS.font_body}', system-ui, sans-serif`,
    // Optional per-site text colours — null/absent falls back to the Naijavend defaults.
    ...(t?.text_color ? { '--st-text': t.text_color } : {}),
    ...(t?.heading_color ? { '--st-heading': t.heading_color } : {}),
    ...(t?.muted_color ? { '--st-muted': t.muted_color } : {}),
    // Listing-card colours + corner radius (null = theme defaults).
    ...(t?.listing_bg_color ? { '--st-listing-bg': t.listing_bg_color } : {}),
    ...(t?.listing_color
      ? { '--st-listing-text': t.listing_color, '--st-listing-heading': t.listing_color }
      : {}),
  } as React.CSSProperties;

  return (
    <div
      className="site-shell"
      data-layout={t?.layout ?? 'modern'}
      data-buttons={t?.button_shape ?? DEFAULTS.button_shape}
      data-cards={t?.card_style ?? DEFAULTS.card_style}
      data-card-radius={t?.card_radius === 'sharp' ? 'sharp' : 'rounded'}
      style={themeStyle}
    >
      {s.announcement && (
        <div className="store-announcement">{s.announcement}</div>
      )}
      <header className="store-masthead">
        <div className="container store-masthead-inner">
          <span className="store-masthead-brand">
            {brandLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
              <img className="store-masthead-logo" src={brandLogo} alt="" />
            )}
            <span className="store-masthead-name">{store.name}</span>
            {s.is_dropshipper && <span className="badge badge-dropship" title="Verified dropshipper">Dropshipper</span>}
            <OpenBadge hours={s.business_hours} />
            <SocialRow links={socials} storeName={store.name} />
          </span>
          <nav className="store-masthead-links" aria-label={`${store.name} site`}>
            <Link href={`/s/${store.slug}`}>Home</Link>
            <Link href={`/s/${store.slug}/catalogue`}>Catalogue</Link>
            {waNumber && <Link href={`/s/${store.slug}#reach`}>Contact</Link>}
            <Link href={`/s/${store.slug}/chat`}>Chat</Link>
            <Link href={`/s/${store.slug}/rate`}>Reviews</Link>
            <Link href="/discover" className="btn btn-outline btn-sm">More on Naijavend</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="site-footer-store">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brandcol">
              <span className="footer-wordmark">{store.name}</span>
              <p className="footer-tagline">
                {store.description
                  ? store.description.slice(0, 160)
                  : `Shop with ${store.name} — orders, bookings and chat, right here.`}
              </p>
              <div className="footer-social">
                <SocialRow links={socials} storeName={store.name} />
              </div>
            </div>
            <nav className="footer-col" aria-label={`${store.name} pages`}>
              <h4>{store.name}</h4>
              <Link href={`/s/${store.slug}`}>Home</Link>
              <Link href={`/s/${store.slug}/catalogue`}>Catalogue</Link>
              <Link href={`/s/${store.slug}/chat`}>Chat</Link>
              <Link href={`/s/${store.slug}/rate`}>Reviews</Link>
            </nav>
            <nav className="footer-col" aria-label="Orders and support">
              <h4>Support</h4>
              {waNumber && <Link href={`/s/${store.slug}#reach`}>Contact & location</Link>}
              <Link href="/discover">More stores</Link>
              <Link href="/faq">Help & FAQ</Link>
              <Link href="/dashboard">Sell on Naijavend</Link>
            </nav>
            <nav className="footer-col" aria-label="Legal">
              <h4>Legal</h4>
              <Link href="/legal/privacy">Privacy policy</Link>
              <Link href="/legal/terms">User agreement</Link>
              <Link href="/legal/cookies">Cookies policy</Link>
            </nav>
          </div>
          <div className="footer-base">
            <span>
              © {new Date().getFullYear()} {store.name}. All rights reserved.
            </span>
            <span>
              Built on{' '}
              <Link href="/">Naijavend</Link> — storefronts for Nigerian sellers. 🇳🇬
            </span>
          </div>
        </div>
      </footer>
      <BackToMarket label="Naijavend" />
    </div>
  );
}
