'use client';

// Buyer bottom navigation (REDESIGN_V2 §4.1): Home, Map, Orders, You.
// Phones only (hidden ≥ 768px by styles/shell.css). Active tab: blue icon and
// label with a short gradient underline that slides between tabs (Motion
// layoutId). Respects safe-area insets.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { Home, Map as MapIcon, Package, UserRound, type LucideIcon } from 'lucide-react';
import { SPRING } from '@/lib/motion';

const TABS: Array<{ href: string; label: string; Icon: LucideIcon; match: (p: string) => boolean }> = [
  { href: '/home', label: 'Home', Icon: Home, match: (p) => p === '/home' || p.startsWith('/discover') || p.startsWith('/search') },
  { href: '/map', label: 'Map', Icon: MapIcon, match: (p) => p.startsWith('/map') },
  { href: '/account', label: 'Orders', Icon: Package, match: (p) => p === '/account' || p.startsWith('/checkout') },
  {
    href: '/account/profile',
    label: 'You',
    Icon: UserRound,
    match: (p) => p.startsWith('/account/') && !p.startsWith('/account/signin'),
  },
];

export function BuyerBottomNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav className="kv-bottomnav" aria-label="App">
      {TABS.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={active ? 'kv-bottomnav-item is-active' : 'kv-bottomnav-item'}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={22} aria-hidden strokeWidth={active ? 2.3 : 1.9} />
            <span>{label}</span>
            {active && <motion.span layoutId="kv-bottomnav-bar" className="kv-bottomnav-bar" transition={SPRING.snappy} />}
          </Link>
        );
      })}
    </nav>
  );
}
