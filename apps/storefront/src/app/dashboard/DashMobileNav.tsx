'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { purgeSupabaseBrowserState } from '@/lib/oauth-cleanup';

/**
 * Mobile dashboard chrome: a compact sticky top bar (brand, hamburger) plus a
 * slide-in drawer that carries the full nav — replacing the old horizontal tab
 * bar, which couldn't fit ten sections. Desktop (>900px) never renders this:
 * the layout still shows the permanent sidebar, and CSS hides this component.
 */
export function DashMobileNav({
  items,
  roleLabel,
  storeHref,
}: {
  items: { href: string; label: string }[];
  roleLabel: string;
  storeHref?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes (user picked a section).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="dash-mobile">
      <header className="dash-mobile-bar">
        <Link href="/dashboard" className="logo" aria-label="Naijavend dashboard">
          Naija<span>vend</span>
        </Link>
        <div className="dash-mobile-actions">
          <button
            type="button"
            className="dash-mobile-burger"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Scrim + drawer */}
      <div
        className={`dash-mobile-scrim${open ? ' is-open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
      <aside className={`dash-mobile-drawer${open ? ' is-open' : ''}`} aria-hidden={!open} aria-label="Dashboard menu">
        <div className="dash-mobile-drawer-head">
          <span className="dash-sidebar-role">{roleLabel}</span>
          <button type="button" className="dash-mobile-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <nav className="dash-mobile-links">
          {items.map((item) => {
            const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dash-mobile-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                tabIndex={open ? 0 : -1}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="dash-mobile-foot">
          {storeHref && (
            <a href={storeHref} className="dash-mobile-link dash-mobile-view" target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1}>
              View my store ↗
            </a>
          )}
          <form action="/dashboard/signout" method="post">
            <button
              type="submit"
              className="dash-mobile-link dash-mobile-signout"
              onClick={() => purgeSupabaseBrowserState()}
              tabIndex={open ? 0 : -1}
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
