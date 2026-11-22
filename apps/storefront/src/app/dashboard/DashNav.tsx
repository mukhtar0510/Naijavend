'use client';

import type { ComponentType } from 'react';
import { Bike, LifeBuoy, PackageCheck, Truck } from 'lucide-react';

// Lucide icons adapted to the nav's simple { size } icon type.
const IconTruck = ({ size = 17 }: { size?: number }) => <Truck size={size} aria-hidden />;
const IconBike = ({ size = 17 }: { size?: number }) => <Bike size={size} aria-hidden />;
const IconHelp = ({ size = 17 }: { size?: number }) => <LifeBuoy size={size} aria-hidden />;
const IconParcel = ({ size = 17 }: { size?: number }) => <PackageCheck size={size} aria-hidden />;
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
  '/dashboard/dispatch': IconTruck,
  '/dashboard/riders': IconBike,
  '/dashboard/kwaravend-rider': IconParcel,
  '/dashboard/support': IconHelp,
  '/dashboard/bookings': IconCalendar,
  '/dashboard/customers': IconUsers,
  '/dashboard/staff': IconUsers,
  '/dashboard/chat': IconChat,
  '/dashboard/ai': IconSpark,
  '/dashboard/analytics': IconChart,
  '/dashboard/ratings': IconStar,
  '/dashboard/plan': IconSpark,
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
