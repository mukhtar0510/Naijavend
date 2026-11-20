import { BookOpen, Cake, Scissors, Shirt, ShoppingBasket, Smartphone, Truck, Wrench } from 'lucide-react';
// Shared brand copy for the two public brand pages.
//
// `/` is the brand's front door (the full Kwaravend story, product layers and
// live components). `/about` is the focused story page. They intentionally
// draw from this one module so the principles, trust rules and audience copy
// never drift apart.

export const PRINCIPLES = [
  {
    k: '01',
    title: 'The storefront is the product',
    body: 'Not a directory listing. A seller’s link carries their catalogue, prices, hours, photos, chat and reviews — the same place buyers land from a WhatsApp broadcast, a bio or a QR sticker on the counter.',
  },
  {
    k: '02',
    title: 'Trust is earned in public',
    body: 'Reviews only come from real transactions, rankings weigh recency, and the blue tick has a rule anyone can check. Reputation is a record of work, not a graphic someone can buy.',
  },
  {
    k: '03',
    title: 'Free has to mean free',
    body: 'The POS, staff logins and extra branches are included. A business should not have to outgrow Kwaravend before it can afford to run itself properly.',
  },
] as const;

export const MARKET = [
  'No commission on your sales',
  'No card to start',
  'Blue tick has a public rule',
  'Location stays in your browser',
  'POS, staff & branches included',
  'Reviews tied to real orders',
  'WhatsApp-first checkout',
  'Made in Nigeria',
] as const;

export const PERSONAS = [
  { ico: Cake, title: 'Cake & food studios', text: 'Pre-orders, delivery windows, weekend slots.' },
  { ico: Scissors, title: 'Beauty & braids', text: 'Bookings that don’t double-up, price lists that stay current.' },
  { ico: Smartphone, title: 'Phones & gadgets', text: 'Stock counts, variants and a catalogue buyers can trust.' },
  { ico: Shirt, title: 'Fashion & thrift', text: 'Lookbooks, sizes, drops and DM-free ordering.' },
  { ico: BookOpen, title: 'Tutors & lessons', text: 'Recurring slots, packages and student reviews.' },
  { ico: Wrench, title: 'Home services', text: 'Coverage areas, call-outs and service pricing.' },
  { ico: Truck, title: 'Dropshippers', text: 'Honest shipping windows on every listing.' },
  { ico: ShoppingBasket, title: 'Markets & pop-ups', text: 'Free POS for the stall, storefront for the rest of the week.' },
] as const;

/** Trust rules are modules (icons), so this one is typed by the consumer. */
export const TRUST = [
  {
    icon: 'badge',
    title: 'The blue tick',
    body: 'Awarded at 30+ reviews averaging 4 stars, reviewed against the store’s own stats — and revocable if review integrity breaks.',
  },
  {
    icon: 'star',
    title: 'Reviews from real orders',
    body: 'Only buyers with an order or booking can rate. Rankings blend score, volume and recency so old glory fades.',
  },
  {
    icon: 'pin',
    title: 'Location, kept local',
    body: 'Distance and direction are calculated in your browser. Your coordinates are never sent to our servers.',
  },
  {
    icon: 'shield',
    title: 'Report and moderation',
    body: 'Every store and listing has a report path. Fake reviews and impersonation are removed and can cost an account.',
  },
] as const;

export const POPULAR = [
  { href: '/faq', q: 'How much does a store cost?' },
  { href: '/faq', q: 'How do I get the blue verification tick?' },
  { href: '/faq', q: 'How does the map “distance from you” work?' },
  { href: '/faq', q: 'Who is allowed to review a store?' },
] as const;
