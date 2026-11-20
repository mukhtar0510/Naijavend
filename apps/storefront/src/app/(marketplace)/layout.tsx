import '../../styles/marketplace-v2.css';
import '../../styles/marketplace-mobile.css';
import '../../styles/store-designer.css';
import '../../styles/system.css';
import { SiteHeader } from '@/components/SiteHeader';
import { CookieBanner } from '@/components/CookieBanner';
import { SiteFooter } from '@/components/SiteFooter';

// Marketplace chrome: wraps every public page EXCEPT / (the landing page has its
// own group so it can skip this stylesheet) and /s/* store pages, which render as
// the seller's own independent site.
export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <CookieBanner />
    </>
  );
}
