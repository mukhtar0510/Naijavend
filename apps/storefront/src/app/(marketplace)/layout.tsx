import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { CookieBanner } from '@/components/CookieBanner';
import {
  InstagramIcon,
  XIcon,
  FacebookIcon,
  TikTokIcon,
  YouTubeIcon,
} from '@/components/SocialIcons';

// Marketplace chrome: wraps every public page EXCEPT /s/* store pages, which render
// as the seller's own independent site with its own masthead and footer.

const SOCIALS: Array<{ label: string; href: string; Icon: (p: { size?: number }) => React.ReactNode }> = [
  { label: 'Naijavend on Instagram', href: 'https://instagram.com/naijavend.ng', Icon: InstagramIcon },
  { label: 'Naijavend on X (Twitter)', href: 'https://x.com/naijavendng', Icon: XIcon },
  { label: 'Naijavend on Facebook', href: 'https://facebook.com/naijavend.ng', Icon: FacebookIcon },
  { label: 'Naijavend on TikTok', href: 'https://tiktok.com/@naijavend.ng', Icon: TikTokIcon },
  { label: 'Naijavend on YouTube', href: 'https://youtube.com/@naijavend', Icon: YouTubeIcon },
];

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brandcol">
              <span className="footer-wordmark">Naijavend</span>
              <p className="footer-tagline">
                Storefronts for Nigerian sellers — every store gets its own real website,
                catalogue, bookings and chat, free.
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
              <Link href="/discover">Discover stores</Link>
              <Link href="/rankings">Rankings</Link>
              <Link href="/search">Search</Link>
              <Link href="/about">About Naijavend</Link>
            </nav>
            <nav className="footer-col" aria-label="Sellers">
              <h4>For sellers</h4>
              <Link href="/dashboard">Sell on Naijavend</Link>
              <Link href="/dashboard/signin">Seller sign in</Link>
              <Link href="/account/signin">My account</Link>
            </nav>
            <nav className="footer-col" aria-label="Legal and help">
              <h4>Help &amp; legal</h4>
              <Link href="/faq">FAQ</Link>
              <Link href="/legal/privacy">Privacy policy</Link>
              <Link href="/legal/terms">User agreement</Link>
              <Link href="/legal/cookies">Cookies policy</Link>
            </nav>
          </div>
          <div className="footer-base">
            <span>© {new Date().getFullYear()} Naijavend. All rights reserved.</span>
            <span>Made in Nigeria 🇳🇬</span>
          </div>
        </div>
      </footer>
      <CookieBanner />
    </>
  );
}
