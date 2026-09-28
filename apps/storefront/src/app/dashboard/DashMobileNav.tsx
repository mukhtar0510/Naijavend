'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { purgeSupabaseBrowserState } from '@/lib/oauth-cleanup';

/**
 * Mobile dashboard chrome: a compact sticky top bar (brand, theme toggle,
 * hamburger) plus a slide-in drawer that carries the full nav — replacing
 * the old horizontal tab bar, which couldn't fit ten sections and hid the
 * theme toggle entirely. Desktop (>900px) never renders this: the layout
 * still shows the permanent sidebar, and CSS hides this whole component.
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => {
    setMounted(true);
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem('sf-theme', next);
    } catch {
      // Private mode — theme just won't persist.
    }
  }

  const dark = mounted && theme === 'dark';

  return (
    <div className="dash-mobile">
      <header className="dash-mobile-bar">
        <Link href="/dashboard" className="logo" aria-label="Naijavend dashboard">
          Naija<span>vend</span>
        </Link>
        <div className="dash-mobile-actions">
          <button
            type="button"
            className="theme-toggle-compact"
            onClick={toggleTheme}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {!mounted ? (
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                <circle cx="12" cy="12" r="4" />
              </svg>
            ) : dark ? (
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 3v2.1M12 18.9V21M21 12h-2.1M5.1 12H3M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5M18.4 18.4l-1.5-1.5M7.1 7.1 5.6 5.6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.5 13.2A8.1 8.1 0 0 1 10.8 3.5a8.1 8.1 0 1 0 9.7 9.7Z" />
              </svg>
            )}
          </button>
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
