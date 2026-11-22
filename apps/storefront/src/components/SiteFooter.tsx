import Link from 'next/link';
import { BRAND } from '@idevtenancy/shared';
import { FEATURES } from '@/lib/flags';
import { InstagramIcon, XIcon, FacebookIcon, TikTokIcon } from '@/components/SocialIcons';

// Only render accounts the owner has actually set in BRAND.socials. Empty
// strings are skipped rather than linking to an unowned or invented handle.
const SOCIALS: Array<{ label: string; href: string; Icon: (p: { size?: number }) => React.ReactNode }> = [
  { label: `${BRAND.name} on Instagram`, href: BRAND.socials.instagram, Icon: InstagramIcon },
  { label: `${BRAND.name} on X (Twitter)`, href: BRAND.socials.x, Icon: XIcon },
  { label: `${BRAND.name} on Facebook`, href: BRAND.socials.facebook, Icon: FacebookIcon },
  { label: `${BRAND.name} on TikTok`, href: BRAND.socials.tiktok, Icon: TikTokIcon },
].filter((s) => s.href.length > 0);

/** Shared marketplace footer — used by the marketplace and landing layouts. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brandcol">
            <span className="footer-wordmark">Kwaravend</span>
            <p className="footer-tagline">
              Storefronts for Ilorin sellers — turn a WhatsApp catalogue into a real website with
              naira prices, bookings and chat, free. Launching in Kwara State.
            </p>
            <div className="footer-social">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a key={label} href={href} aria-label={label} target="_blank" rel="noreferrer noopener">
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>
          <nav className="footer-col" aria-label="Marketplace">
            <h4>Marketplace</h4>
            <Link href="/home">Home</Link>
            <Link href="/discover">Discover stores</Link>
            {FEATURES.rankings ? <Link href="/rankings">Rankings</Link> : null}
            <Link href="/search">Search</Link>
            <Link href="/about">About Kwaravend</Link>
          </nav>
          <nav className="footer-col" aria-label="Sellers">
            <h4>For sellers</h4>
            <Link href="/dashboard">Sell on Kwaravend</Link>
            <Link href="/dashboard/signin">Seller sign in</Link>
            <Link href="/pricing">Plans and pricing</Link>
            <Link href="/account/signin">My account</Link>
          </nav>
          <nav className="footer-col" aria-label="Legal and help">
            <h4>Help &amp; legal</h4>
            <Link href="/faq">FAQ</Link>
            <Link href="/legal/privacy">Privacy policy</Link>
            <Link href="/legal/terms">User agreement</Link>
            <Link href="/legal/cookies">Cookies policy</Link>
            {BRAND.supportEmail && <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>}
          </nav>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</span>
          <span>Made in Nigeria </span>
        </div>
      </div>
    </footer>
  );
}
