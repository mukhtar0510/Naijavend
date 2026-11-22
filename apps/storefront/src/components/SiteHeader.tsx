'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Menu,
  Search,
  Store,
  UserRound,
  X,
} from 'lucide-react';
import { KwaravendLogoMark } from '@/components/KwaravendLogo';
import { MobileMenu } from '@/components/shell/MobileMenu';
import { FEATURES } from '@/lib/flags';

// One row of navigation. Everything else lives where it belongs: categories on
// the home page, help/legal in the footer, selling in the primary button.
const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/discover', label: 'Discover' },
  { href: '/products', label: 'Products' },
  { href: '/map', label: 'Map' },
  // Rankings stay hidden until a city has enough active stores (see T13).
  ...(FEATURES.rankings ? [{ href: '/rankings', label: 'Rankings' }] : []),
  { href: '/about', label: 'About' },
];


/**
 * Marketplace header.
 *
 * Search is the primary navigation layer: logo left, a wide search field in the
 * middle, three links plus account/sell on the right. There is no second header
 * row — the trade list lives on the home page and in the mobile drawer.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Route changes should always close the drawer (link click, back button).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const closeMenu = useCallback(() => setOpen(false), []);

  // The header box shows what was searched for on /search, and clears elsewhere.
  // Read from the URL after navigation (no useSearchParams: this header sits
  // in static layouts).
  const [headerQ, setHeaderQ] = useState('');
  useEffect(() => {
    setHeaderQ(pathname === '/search' ? (new URLSearchParams(window.location.search).get('q') ?? '') : '');
  }, [pathname]);

  return (
    <header className="nv-header">
      <div className="container nv-header-main">
        <Link href="/" className="nv-header-logo" aria-label="Kwaravend home">
          <KwaravendLogoMark size={30} />
          <span className="nv-header-wordmark">
            Kwara<em>vend</em>
          </span>
        </Link>

        <form
          className="nv-header-search"
          action="/search"
          role="search"
          onSubmit={(e) => {
            // An empty search goes nowhere: keep the buyer in the box instead.
            if (!headerQ.trim()) {
              e.preventDefault();
              (e.currentTarget.elements.namedItem('q') as HTMLInputElement | null)?.focus();
            }
          }}
        >
          <Search size={17} aria-hidden className="nv-header-search-icon" />
          <input
            type="search"
            name="q"
            value={headerQ}
            onChange={(e) => setHeaderQ(e.target.value)}
            maxLength={80}
            enterKeyHint="search"
            placeholder="Search products, services or stores…"
            aria-label="Search products, services or stores"
            autoComplete="off"
          />
          <button type="submit" className="nv-header-search-btn">
            Search
          </button>
        </form>

        <div className="nv-header-actions">
          <nav className="nv-header-links" aria-label="Primary">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nv-header-top-link${isActive(l.href) ? ' is-active' : ''}`}
                aria-current={isActive(l.href) ? 'page' : undefined}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link href="/account" className={`nv-header-account${isActive('/account') ? ' is-active' : ''}`}>
            <UserRound size={17} aria-hidden />
            <span>Account</span>
          </Link>
          <Link href="/dashboard/signin" className="nv-header-top-link nv-header-sellerlogin">
            Seller login
          </Link>
          <Link href="/dashboard" className="btn btn-cta btn-sm nv-header-sell">
            <Store size={15} aria-hidden />
            Sell free
          </Link>
          <button
            type="button"
            className="nv-header-burger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="nv-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Phone menu: slide-in panel with seller login (owner, 21 Nov 2026). */}
      <MobileMenu open={open} onClose={closeMenu} isActive={isActive} />
    </header>
  );
}
