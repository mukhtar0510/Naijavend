import '../../styles/header.css';
import '../../styles/system.css';
import '../../styles/store-designer.css';
import '../../styles/scene.css';
import '../../styles/hero.css';
import '../../styles/site-preview.css';
import { SiteHeader } from '@/components/SiteHeader';
import { CookieBanner } from '@/components/CookieBanner';
import { SiteFooter } from '@/components/SiteFooter';

// The landing page gets the same chrome as the marketplace but not the
// marketplace stylesheet: it only needs the header rules (extracted into
// header.css), which cuts the largest stylesheet off the marketing page.
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <CookieBanner />
    </>
  );
}
