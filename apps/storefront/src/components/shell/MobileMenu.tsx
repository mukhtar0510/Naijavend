'use client';

// Phone menu for the marketplace header (owner, 21 Nov 2026: redesign it and
// add "Log in as a seller"). A right-side panel that slides in over a scrim:
// account cards first (seller login, open a store, shop sign-in), then the
// main links, the Ilorin area dropdown, trades, and the theme switch.
// Closes on the scrim, the X, Esc, or any route change; the page behind
// doesn't scroll while it's open; focus moves into the panel and back.

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Compass,
  HelpCircle,
  Home,
  Info,
  LogIn,
  Map as MapIcon,
  Moon,
  ShoppingBag,
  Store,
  Sun,
  Trophy,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { BRAND, categoryLabel } from '@idevtenancy/shared';
import { CategoryIcon } from '@/lib/categories';
import { FEATURES } from '@/lib/flags';
import { SPRING, T } from '@/lib/motion';
import { AreaSelector } from './AreaSelector';

const LINKS: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: '/home', label: 'Home', Icon: Home },
  { href: '/discover', label: 'Discover stores', Icon: Compass },
  { href: '/map', label: 'Map of Kwara', Icon: MapIcon },
  ...(FEATURES.rankings ? [{ href: '/rankings', label: 'Rankings', Icon: Trophy }] : []),
  { href: '/about', label: `About ${BRAND.name}`, Icon: Info },
  { href: '/faq', label: 'Help and FAQ', Icon: HelpCircle },
];

const TRADES = ['fashion', 'beauty', 'food', 'electronics', 'home-services', 'groceries'];

export function MobileMenu({
  open,
  onClose,
  isActive,
}: {
  open: boolean;
  onClose: () => void;
  isActive: (href: string) => boolean;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [dark, setDark] = React.useState(false);
  // Rendered into <body>: the header's backdrop-filter would otherwise trap
  // this fixed panel inside the header strip.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const returnTo = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('a, button, select')?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // keep Tab inside the panel
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('a, button, select');
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      returnTo?.focus?.();
    };
  }, [open, onClose]);

  function toggleTheme() {
    const next = dark ? 'light' : 'dark';
    setDark(!dark);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem('sf-theme', next);
    } catch {
      /* private mode */
    }
  }

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="kv-mmenu-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={T.base}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            id="nv-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="kv-mmenu"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={SPRING.sheet}
            onClick={(e: { stopPropagation(): void }) => e.stopPropagation()}
          >
            <div className="kv-mmenu-head">
              <span className="kv-mmenu-brand">
                {BRAND.wordmark.first}
                <em>{BRAND.wordmark.second}</em>
              </span>
              <button type="button" className="kv-mmenu-x" aria-label="Close menu" onClick={onClose}>
                <X size={20} aria-hidden />
              </button>
            </div>

            {/* Accounts first: who are you here as? */}
            <div className="kv-mmenu-accounts">
              <div className="kv-mmenu-card is-seller">
                <span className="kv-mmenu-card-ico" aria-hidden>
                  <Store size={20} />
                </span>
                <div className="kv-mmenu-card-body">
                  <strong>I sell</strong>
                  <span>Manage your store, orders and deliveries.</span>
                </div>
                <div className="kv-mmenu-card-actions">
                  <Link href="/dashboard/signin" className="btn btn-primary btn-sm">
                    <LogIn size={15} aria-hidden /> Log in as a seller
                  </Link>
                  <Link href="/dashboard" className="btn btn-cta btn-sm">
                    Open a free store
                  </Link>
                </div>
              </div>
              <div className="kv-mmenu-card">
                <span className="kv-mmenu-card-ico is-buyer" aria-hidden>
                  <ShoppingBag size={20} />
                </span>
                <div className="kv-mmenu-card-body">
                  <strong>I shop</strong>
                  <span>Your orders, bookings, chats and saved stores.</span>
                </div>
                <div className="kv-mmenu-card-actions">
                  <Link href="/account" className="btn btn-outline btn-sm">
                    <UserRound size={15} aria-hidden /> My account
                  </Link>
                  <Link href="/account/signin" className="btn btn-ghost btn-sm">
                    Sign in to shop
                  </Link>
                </div>
              </div>
            </div>

            <nav className="kv-mmenu-links" aria-label="Main">
              {LINKS.map(({ href, label, Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={active ? 'kv-mmenu-link is-active' : 'kv-mmenu-link'}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={19} aria-hidden />
                    <span>{label}</span>
                    <ArrowRight size={15} aria-hidden className="kv-mmenu-arrow" />
                  </Link>
                );
              })}
            </nav>

            <div className="kv-mmenu-block">
              <p className="kv-mmenu-title">Your area</p>
              <AreaSelector label="Your area in Ilorin" />
            </div>

            <div className="kv-mmenu-block">
              <p className="kv-mmenu-title">Shop by trade</p>
              <div className="kv-mmenu-trades">
                {TRADES.map((c) => (
                  <Link key={c} href={`/discover?category=${c}`} className="kv-mmenu-trade">
                    <CategoryIcon category={c} size={18} />
                    <span>{categoryLabel(c)}</span>
                  </Link>
                ))}
              </div>
              <Link href="/discover" className="kv-mmenu-all">
                All categories <ArrowRight size={14} aria-hidden />
              </Link>
            </div>

            <div className="kv-mmenu-foot">
              <button type="button" className="kv-mmenu-theme" onClick={toggleTheme} aria-pressed={dark}>
                {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
                {dark ? 'Light mode' : 'Dark mode'}
              </button>
              {BRAND.supportEmail && (
                <a href={`mailto:${BRAND.supportEmail}`} className="kv-mmenu-mail">
                  {BRAND.supportEmail}
                </a>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
