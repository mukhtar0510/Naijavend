'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NaijavendLogoMark } from '@/components/NaijavendLogo';

const LINKS = [
  { href: '/discover', label: 'Discover stores' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/search', label: 'Search' },
  { href: '/about', label: 'About' },
];

// Marketplace header: glassy sticky bar with pill navigation, active-page
// highlight and a gradient accent edge. Rendered on every public page.
export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="topnav">
      <div className="container topnav-inner">
        <Link href="/" className="logo" aria-label="Naijavend home" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <NaijavendLogoMark size={28} />
          Naija<span>vend</span>
        </Link>
        <div className="topnav-links">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`topnav-pill${isActive(l.href) ? ' is-active' : ''}`}
              aria-current={isActive(l.href) ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="topnav-actions">
          <ThemeToggle />
          <Link href="/account" className={`topnav-account${pathname.startsWith('/account') ? ' is-active' : ''}`}>
            <span className="topnav-avatar" aria-hidden>👤</span>
            <span className="topnav-account-label">My account</span>
          </Link>
          <Link href="/dashboard" className="btn btn-black btn-sm topnav-sell">
            <span className="sell-long">Sell on Naijavend</span>
            <span className="sell-short">Sell</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
