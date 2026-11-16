'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Menu,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  X,
} from 'lucide-react';
import { NaijavendLogoMark } from '@/components/NaijavendLogo';
import { categoryEmoji, categoryLabel } from '@idevtenancy/shared';

const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/discover', label: 'Discover' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/faq', label: 'FAQ' },
];

// Header category rail — the highest-traffic trades only. The full list lives
// on /discover, which is one click away at the end of the rail.
const QUICK_CATEGORIES = [
  'fashion',
  'beauty',
  'food',
  'electronics',
  'home-services',
  'groceries',
  'crafts',
];

/**
 * Marketplace header.
 *
 * Search is the primary navigation layer (the pattern every large marketplace
 * uses): logo left, a wide search field in the middle, account/sell on the
 * right, and a second rail for browsing by trade. Phones get a compact bar
 * plus a full menu drawer instead of a squeezed two-row header.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Route changes should always close the drawer (link click, back button).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the drawer for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="nv-header">
      <div className="container nv-header-main">
        <Link href="/" className="nv-header-logo" aria-label="Naijavend home">
          <NaijavendLogoMark size={30} />
          <span className="nv-header-wordmark">
            Naija<em>vend</em>
          </span>
        </Link>

        <form className="nv-header-search" action="/search" role="search">
          <Search size={17} aria-hidden className="nv-header-search-icon" />
          <input
            type="search"
            name="q"
            placeholder="Search products, services or stores…"
            aria-label="Search products, services or stores"
            autoComplete="off"
          />
          <button type="submit" className="nv-header-search-btn">
            Search
          </button>
        </form>

        <div className="nv-header-actions">
          <Link href="/rankings" className={`nv-header-top-link${isActive('/rankings') ? ' is-active' : ''}`}>
            Top rated
          </Link>
          <Link href="/account" className={`nv-header-account${isActive('/account') ? ' is-active' : ''}`}>
            <UserRound size={17} aria-hidden />
            <span>Account</span>
          </Link>
          <Link href="/dashboard" className="btn btn-black btn-sm nv-header-sell">
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

      <div className="nv-header-nav">
        <div className="container nv-header-nav-inner">
          <nav className="nv-header-pills" aria-label="Primary">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nv-header-pill${isActive(l.href) ? ' is-active' : ''}`}
                aria-current={isActive(l.href) ? 'page' : undefined}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="nv-header-cats" aria-label="Browse by category">
            <Link href="/discover" className="nv-header-cat is-all">
              All stores
            </Link>
            {QUICK_CATEGORIES.map((c) => (
              <Link key={c} href={`/discover?category=${c}`} className="nv-header-cat">
                <span aria-hidden>{categoryEmoji(c)}</span>
                {categoryLabel(c)}
              </Link>
            ))}
            <Link href="/discover?open=1" className="nv-header-cat is-open">
              <span className="nv-open-dot" aria-hidden /> Open now
            </Link>
          </div>
        </div>
      </div>

      {open && (
        <div className="nv-mobile-menu" id="nv-mobile-menu">
          <div className="container">
            <nav className="nv-mobile-links" aria-label="Mobile primary">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`nv-mobile-link${isActive(l.href) ? ' is-active' : ''}`}
                >
                  {l.label}
                  <ArrowRight size={16} aria-hidden />
                </Link>
              ))}
              <Link href="/account" className="nv-mobile-link">
                My account
                <UserRound size={16} aria-hidden />
              </Link>
            </nav>

            <p className="nv-mobile-title">Shop by trade</p>
            <div className="nv-mobile-cats">
              {QUICK_CATEGORIES.map((c) => (
                <Link key={c} href={`/discover?category=${c}`} className="nv-header-cat">
                  <span aria-hidden>{categoryEmoji(c)}</span>
                  {categoryLabel(c)}
                </Link>
              ))}
            </div>

            <Link href="/dashboard" className="btn btn-primary nv-mobile-sell">
              <ShieldCheck size={16} aria-hidden />
              Open your free store
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
