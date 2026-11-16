'use client';

// Seller / buyer split, built on the app's shadcn-style Tabs primitive.
// Same feature truth as the dashboard and store pages, grouped by audience.

import {
  BarChart3,
  CalendarCheck,
  Clock3,
  LayoutGrid,
  MapPin,
  Monitor,
  MessageCircle,
  Search,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SELLER_FEATURES = [
  {
    Icon: Store,
    title: 'Your own store website',
    text: 'A real page at /s/your-name with your logo, colours, fonts and photos.',
  },
  {
    Icon: ShoppingBag,
    title: 'Online orders',
    text: 'Server-verified prices, stock tracking and discount codes — paid or confirmed on WhatsApp.',
  },
  {
    Icon: CalendarCheck,
    title: 'Appointment booking',
    text: 'Services sell real slots. The system blocks double-bookings for you.',
  },
  {
    Icon: Monitor,
    title: 'POS terminal — free',
    text: 'Markets, pop-ups and counters share the same stock and analytics.',
  },
  {
    Icon: Users,
    title: 'Staff accounts — free',
    text: 'Cashiers and managers with their own logins you can suspend in one tap.',
  },
  {
    Icon: MapPin,
    title: 'Multi-branch locations',
    text: 'Each branch keeps its own address, phone and hours, with staff tagged per branch.',
  },
  {
    Icon: BarChart3,
    title: 'Analytics',
    text: 'Visits, shares, chats, orders and conversion — see what sells and where buyers come from.',
  },
  {
    Icon: Truck,
    title: 'Dropshipper mode',
    text: 'Sell supplier-shipped goods with an honest shipping-window card on your store site.',
  },
];

const BUYER_FEATURES = [
  {
    Icon: Search,
    title: 'Find real businesses',
    text: 'Every store is a real Nigerian business with a location, photos and public rankings.',
  },
  {
    Icon: Clock3,
    title: 'Know before you go',
    text: 'Live “Open now / Closed” badges, opening hours and delivery info on every store.',
  },
  {
    Icon: MessageCircle,
    title: 'Chat before you buy',
    text: 'Message the seller in-app or continue on WhatsApp with your question pre-filled.',
  },
  {
    Icon: Star,
    title: 'Honest reviews only',
    text: 'Only customers with a real order or booking can leave a rating. No fake stars.',
  },
  {
    Icon: Tag,
    title: 'Discount codes',
    text: 'Promo codes are validated at checkout, so the price you see is the price agreed.',
  },
  {
    Icon: Wallet,
    title: 'One account, everything',
    text: 'Track orders, bookings, saved stores and chats in one account, with Google sign-in.',
  },
  {
    Icon: LayoutGrid,
    title: 'Saved stores & recent views',
    text: 'Save the shops you love and pick up where you left off on any device.',
  },
  {
    Icon: MapPin,
    title: 'Distance, not guesswork',
    text: 'Stores are placed by real distance and direction, with walking and driving estimates.',
  },
];

function FeatureGrid({ items }: { items: typeof SELLER_FEATURES }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(({ Icon, title, text }) => (
        <div
          key={title}
          className="brand-card-lift flex items-start gap-3 rounded-[14px] border border-border bg-card p-4"
        >
          <span className="brand-icon-tile" style={{ width: 36, height: 36, borderRadius: 10 }}>
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <h4 className="mb-1 font-heading text-[14.5px] font-bold tracking-tight text-foreground">{title}</h4>
            <p className="text-[13px] leading-relaxed text-muted-foreground" style={{ maxWidth: '40ch' }}>
              {text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AudienceTabs() {
  return (
    <Tabs defaultValue="sellers" className="gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <TabsList aria-label="Choose an audience">
          <TabsTrigger value="sellers">For sellers</TabsTrigger>
          <TabsTrigger value="buyers">For customers</TabsTrigger>
        </TabsList>
        <span className="hidden text-[12.5px] text-muted-foreground sm:inline">
          Switch tabs — both sides of the marketplace are free.
        </span>
      </div>

      <TabsContent value="sellers">
        <FeatureGrid items={SELLER_FEATURES} />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className={cn(buttonVariants({ size: 'lg' }), 'no-underline')}>
            Open your store — free
          </Link>
          <Link href="/faq" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'no-underline')}>
            Seller questions
          </Link>
        </div>
      </TabsContent>

      <TabsContent value="buyers">
        <FeatureGrid items={BUYER_FEATURES} />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/discover" className={cn(buttonVariants({ size: 'lg' }), 'no-underline')}>
            Discover stores near you
          </Link>
          <Link
            href="/account/signin"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'no-underline')}
          >
            Create a free account
          </Link>
        </div>
      </TabsContent>
    </Tabs>
  );
}
