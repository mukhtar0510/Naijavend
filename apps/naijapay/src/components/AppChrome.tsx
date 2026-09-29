'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { LockScreen } from '@/components/LockScreen';
import { useSessionLock } from '@/lib/wallet';

const TABS = [
  { href: '/', label: 'Home', ico: '🏠' },
  { href: '/transactions', label: 'History', ico: '🧾' },
  { href: '/pay', label: 'Pay', ico: '💳' },
  { href: '/savings', label: 'Savings', ico: '🐷' },
  { href: '/profile', label: 'Profile', ico: '👤' },
];

// Lock-first chrome: while the session is locked, only the PIN pad renders —
// no header, no tabs, no wallet UI leaks.
export function AppChrome({ children }: { children: ReactNode }) {
  const { unlocked } = useSessionLock();
  const pathname = usePathname();

  if (unlocked === null) {
    // Brief hydration window; render an empty shell to avoid flashing the pad.
    return <div className="np-shell" />;
  }
  if (!unlocked) return <LockScreen />;

  return (
    <div className="np-shell">
      <header className="np-header">
        <div className="np-header-inner">
          <Link href="/" className="np-brand">
            Naija<span>Pay</span>
          </Link>
          <span className="badge badge-blue">for Naijavend</span>
          <span className="np-header-spacer" />
          <ThemeButton />
        </div>
      </header>

      <main className="np-main">{children}</main>

      <nav className="np-tabbar" aria-label="Wallet navigation">
        <div className="np-tabbar-inner">
          {TABS.map((t) => {
            const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={`np-tab${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                <span className="np-tab-ico" aria-hidden>{t.ico}</span>
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function ThemeButton() {
  const [dark, setDark] = useState(false);
  const router = useRouter();
  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);
  return (
    <button
      type="button"
      className="np-iconbtn"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => {
        const next = !dark;
        setDark(next);
        if (next) document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
        try {
          localStorage.setItem('naijapay_theme', next ? 'dark' : 'light');
        } catch {
          // ignore
        }
        router.refresh();
      }}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
