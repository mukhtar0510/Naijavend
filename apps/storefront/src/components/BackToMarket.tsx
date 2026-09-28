'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NaijavendLogoMark } from '@/components/NaijavendLogo';

/**
 * Floating "back to the app" pill — appears on every page that lives outside
 * the main marketplace chrome (dashboard, seller store sites, admin, auth).
 * Fixed to the bottom-right corner: always one tap from the front page, and
 * the small × first goes *back* in history when there's somewhere to go back
 * to (e.g. you followed a listing link from the marketplace).
 *
 * Hidden automatically on marketplace routes (/, /discover, /rankings…)
 * where the header already provides navigation.
 */
const MARKET_PREFIXES = ['/discover', '/rankings', '/search', '/about', '/faq', '/legal', '/account', '/offline'];

export function BackToMarket({ label = 'Naijavend home' }: { label?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Skip on marketplace chrome pages.
    const onMarket = pathname === '/' || MARKET_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    setVisible(!onMarket);
  }, [pathname]);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  if (!visible) return null;

  return (
    <div className="back-to-market" role="navigation" aria-label="Back to Naijavend">
      {canGoBack && (
        <button
          type="button"
          className="back-to-market-back"
          onClick={() => router.back()}
          aria-label="Go back to the previous page"
          title="Go back"
        >
          ←
        </button>
      )}
      <Link href="/" className="back-to-market-link" aria-label={label}>
        <NaijavendLogoMark size={20} />
        <span>{label}</span>
      </Link>
    </div>
  );
}
