'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconHome, IconTerminal, IconTag, IconBox, IconCart, IconCalendar,
  IconUsers, IconChat, IconChart, IconStar, IconGear, IconSpark,
} from '@/components/NavIcons';

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  '/dashboard': IconHome,
  '/dashboard/pos': IconTerminal,
  '/dashboard/listings': IconTag,
  '/dashboard/orders': IconBox,
  '/dashboard/bookings': IconCalendar,
  '/dashboard/staff': IconUsers,
  '/dashboard/chat': IconChat,
  '/dashboard/ai': IconSpark,
  '/dashboard/analytics': IconChart,
  '/dashboard/ratings': IconStar,
  '/dashboard/settings': IconGear,
};

// Sidebar nav with the current section highlighted. Layout is a server
// component, so the active state lives in this small client wrapper.
export function DashNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="dash-sidebar-nav" aria-label="Seller dashboard">
      {items.map((item) => {
        const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
        const Icon = ICONS[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`dash-sidebar-link${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {Icon && <Icon />}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
