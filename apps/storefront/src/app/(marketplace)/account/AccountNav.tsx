'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconCart, IconCalendar, IconChat, IconUser } from '@/components/NavIcons';

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  '/account': IconCart,
  '/account/bookings': IconCalendar,
  '/account/chats': IconChat,
  '/account/profile': IconUser,
};

// Buyer account tabs with the current section highlighted (same pattern as
// the seller dash-sidebar active link).
export function AccountNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const active = item.href === '/account' ? pathname === '/account' : pathname.startsWith(item.href);
        const Icon = ICONS[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`account-tab${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {Icon && <Icon size={15} />}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}
