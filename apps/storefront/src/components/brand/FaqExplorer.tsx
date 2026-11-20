'use client';

// FAQ explorer: live search + category rail + animated accordion.
// Content lives here so the filters can search plain text while answers keep
// real links. Everything is server-rendered first; motion only enhances it.

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { FEATURES } from '@/lib/flags';
import {
  ChevronDown,
  CircleHelp,
  LifeBuoy,
  MessageCircle,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Heart as IcHeart, Truck as IcTruck } from 'lucide-react';

type FaqItem = {
  id: string;
  group: string;
  q: string;
  text: string;
  answer: React.ReactNode;
};

const GROUPS = ['Buying', 'Selling', 'Reviews & rankings', 'Map & location', 'Account & privacy'] as const;

const FAQS: FaqItem[] = [
  {
    id: 'order',
    group: 'Buying',
    q: 'How do I order a product or book a service?',
    text: 'order product book service whatsapp chat checkout pay pickup delivery',
    answer: (
      <>
        Open any store, pick an item, and use <strong>Order</strong> (products) or <strong>Book</strong> (services).
        You&apos;ll get a summary you can send to the seller on WhatsApp or in-app chat to confirm payment and
        collection or delivery. Prices are re-checked on the server before the order is created.
      </>
    ),
  },
  {
    id: 'legit',
    group: 'Buying',
    q: 'How do I know a store is legit?',
    text: 'legit real scam trust verified blue tick address map reviews',
    answer: (
      <>
        Every store is a real business with an address on the map. Check the star rating and reviews, look for the{' '}
        <strong>blue tick</strong> (30+ reviews averaging 4 stars), and open the map view to see exactly where they
        are. If something feels wrong, use the report button on the store page.
      </>
    ),
  },
  {
    id: 'discounts',
    group: 'Buying',
    q: 'What are discount codes?',
    text: 'discount promo code coupon checkout price',
    answer:
      'Sellers can create promo codes. If a store has one, enter it at checkout — the discount is applied to the order total before you send it, so both sides agree the same number.',
  },
  {
    id: 'free',
    group: 'Selling',
    q: 'How much does a store cost?',
    text: 'cost price free commission subscription fees selling',
    answer: (
      <>
        Free. Your own store website (<em>kwaravend.com/s/your-name</em>), catalogue, bookings, chat and analytics cost
        nothing to start. Create an account from the <Link href="/dashboard/signin">seller sign-in</Link> page.
      </>
    ),
  },
  {
    id: 'bluetick',
    group: 'Selling',
    q: 'How do I get the blue verification tick?',
    text: 'blue tick verification verified badge apply reviews stars',
    answer: (
      <>
        Collect <strong>30+ genuine reviews averaging 4 stars or more</strong>, then apply from your dashboard. We check
        the store&apos;s own review stats — never buy or trade reviews; verified badges can be revoked if review
        integrity is compromised.
      </>
    ),
  },
  {
    id: 'dropship',
    group: 'Selling',
    q: 'What are dropshipper stores?',
    text: 'dropshipper dropshipping supplier shipping delivery window badge',
    answer: (
      <>
        Dropshippers ship items directly from a supplier to the customer. They carry the <strong><IcTruck className="ico-inline" aria-hidden /> Dropshipper</strong>{' '}
        badge and publish their typical delivery window on their store site, so buyers know what to expect.
      </>
    ),
  },
  {
    id: 'pos-staff',
    group: 'Selling',
    q: 'Are the POS, staff accounts and branches really free?',
    text: 'pos terminal staff cashier manager branches locations multi-branch free',
    answer:
      'Yes. The POS terminal, staff logins with their own permissions, and multiple branch locations are included with your store. Suspend or remove a staff member in one tap from the dashboard.',
  },
  {
    id: 'reviews',
    group: 'Reviews & rankings',
    q: 'Who can review a store?',
    text: 'review rating stars who can review purchase order booking fake',
    answer: (
      <>
        Only customers who actually ordered or booked through the store&apos;s site — every store has a review link tied
        to real transactions. That&apos;s what keeps the rankings honest.
      </>
    ),
  },
  {
    id: 'rankings',
    group: 'Reviews & rankings',
    q: 'How do rankings work?',
    text: 'rankings rank score volume recency weight leaderboard',
    answer: (
      <>
        Stores are ranked by review score and volume with recency weighting
        {FEATURES.rankings ? (
          <>
            {' '}— see the <Link href="/rankings">Rankings</Link> page
          </>
        ) : (
          ' — the public leaderboard opens once a city has enough active stores'
        )}
        . Fake reviews are removed and can cost an account.
      </>
    ),
  },
  {
    id: 'map',
    group: 'Map & location',
    q: 'How does the map and “distance from you” work?',
    text: 'map distance location gps share area driving walking privacy',
    answer: (
      <>
        Share your location once (or pick a base area like Tanke or Fate) and every store is placed by real
        distance and direction, with walking and driving estimates. Your location is{' '}
        <strong>stored only in your browser</strong> — it is never sent to our servers.
      </>
    ),
  },
  {
    id: 'qr',
    group: 'Map & location',
    q: 'What are the QR codes for?',
    text: 'qr code scan print price tag shop window link product store',
    answer:
      'Every store and product page has its own QR code in the seller’s brand colours, with the plain link underneath. Print it for a shop window, a price tag, a flyer or a receipt — buyers land exactly where they should.',
  },
  {
    id: 'signin',
    group: 'Account & privacy',
    q: 'How do I sign in?',
    text: 'sign in login google account password auth email',
    answer: (
      <>
        <strong>Continue with Google</strong> — one tap, no password to remember. Sellers and shoppers use separate
        logins, and you can be both with the same Google account.
      </>
    ),
  },
  {
    id: 'saved',
    group: 'Account & privacy',
    q: 'What are saved stores and referrals?',
    text: 'saved stores heart referrals invite link friends credit account',
    answer: (
      <>
        Tap the <IcHeart className="ico-inline" aria-hidden /> on any store to save it to your account page. Your invite link sits on the same page — friends who
        sign up through it within 30 days are credited to you.
      </>
    ),
  },
  {
    id: 'data',
    group: 'Account & privacy',
    q: 'What data do you collect?',
    text: 'data privacy collect cookies policy terms delete account',
    answer: (
      <>
        Only what&apos;s needed to run the service — see the <Link href="/legal/privacy">Privacy Policy</Link> and{' '}
        <Link href="/legal/cookies">Cookies Policy</Link> for the plain-English version.
      </>
    ),
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function FaqExplorer() {
  const [query, setQuery] = React.useState('');
  const [group, setGroup] = React.useState<string>('All');
  const [open, setOpen] = React.useState<Set<string>>(new Set([FAQS[0].id]));

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return FAQS.filter((item) => {
      const inGroup = group === 'All' || item.group === group;
      const haystack = `${item.q} ${item.text} ${item.group}`.toLowerCase();
      return inGroup && (!needle || haystack.includes(needle));
    });
  }, [query, group]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOpen = filtered.length > 0 && filtered.every((item) => open.has(item.id));
  const counts = React.useMemo(
    () =>
      GROUPS.reduce<Record<string, number>>((acc, name) => {
        acc[name] = FAQS.filter((item) => item.group === name).length;
        return acc;
      }, {}),
    [],
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
      {/* Rail: search, categories, support */}
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="brand-search mb-5">
          <Search size={17} className="brand-search-icon" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions…"
            aria-label="Search frequently asked questions"
            style={{ paddingLeft: 42, paddingRight: query ? 38 : 16 }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 12,
                display: 'inline-flex',
                border: 0,
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div
          className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          <span>Categories</span>
          <span className="font-mono text-[10.5px] normal-case tracking-normal">{filtered.length} shown</span>
        </div>

        <div className="brand-chip-row mb-5 lg:flex-col lg:items-stretch">
          <button
            type="button"
            className={cn('brand-chip lg:justify-between', group === 'All' && 'is-active')}
            onClick={() => setGroup('All')}
            aria-pressed={group === 'All'}
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles size={13} /> All questions
            </span>
            <span className="hidden font-mono text-[11px] opacity-70 lg:inline">{FAQS.length}</span>
          </button>
          {GROUPS.map((name) => (
            <button
              key={name}
              type="button"
              className={cn('brand-chip lg:justify-between', group === name && 'is-active')}
              onClick={() => setGroup(name)}
              aria-pressed={group === name}
            >
              <span>{name}</span>
              <span className="hidden font-mono text-[11px] opacity-70 lg:inline">{counts[name]}</span>
            </button>
          ))}
        </div>

        <div className="hidden rounded-[16px] border border-border bg-card p-4 shadow-sm lg:block">
          <span className="brand-icon-tile mb-3">
            <LifeBuoy size={18} />
          </span>
          <h3 className="mb-1 font-heading text-[14.5px] font-bold tracking-tight text-foreground">
            Still stuck?
          </h3>
          <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
            Chat any seller directly from their store page, or read the plain-English policies.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/discover" className="text-[13px] font-semibold">
              Browse stores →
            </Link>
            <Link href="/legal" className="text-[13px] font-semibold">
              Legal &amp; policies →
            </Link>
            <Link href="/dashboard" className="text-[13px] font-semibold">
              Sell on Kwaravend →
            </Link>
          </div>
        </div>
      </aside>

      {/* Results */}
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-[13px] text-muted-foreground">
            {filtered.length === 0
              ? 'No matching questions'
              : `${filtered.length} question${filtered.length === 1 ? '' : 's'}${
                  group === 'All' ? '' : ` in ${group}`
                }`}
          </p>
          <button
            type="button"
            className="text-[12.5px] font-semibold text-primary"
            onClick={() =>
              setOpen(allOpen ? new Set() : new Set(filtered.map((item) => item.id)))
            }
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>

        <div className="grid gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {filtered.map((item) => {
              const isOpen = open.has(item.id);
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className={cn('brand-faq-shell', isOpen && 'is-open')}
                >
                  <h3 className="m-0">
                    <button
                      type="button"
                      className="brand-faq-trigger"
                      aria-expanded={isOpen}
                      aria-controls={`faq-${item.id}`}
                      onClick={() => toggle(item.id)}
                    >
                      <span
                        className="mt-0.5 hidden font-mono text-[11px] font-semibold text-muted-foreground sm:inline"
                        style={{ minWidth: 54 }}
                      >
                        {item.group}
                      </span>
                      <span className="flex-1">{item.q}</span>
                      <ChevronDown size={18} className="brand-faq-chevron" aria-hidden />
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="answer"
                        id={`faq-${item.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="brand-faq-answer">{item.answer}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[16px] border border-dashed border-border-strong bg-muted p-8 text-center"
          >
            <span className="brand-icon-tile mx-auto mb-3">
              <CircleHelp size={18} />
            </span>
            <h3 className="mb-1 font-heading text-base font-bold text-foreground">Nothing matched “{query}”</h3>
            <p className="mx-auto mb-4 max-w-[42ch] text-[13.5px] text-muted-foreground">
              Try a shorter phrase like “blue tick”, “POS”, “map” or “privacy” — or reset the filters and browse by
              category.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="brand-chip"
                onClick={() => {
                  setQuery('');
                  setGroup('All');
                }}
              >
                Reset filters
              </button>
              <Link href="/discover" className="brand-chip">
                <MessageCircle size={13} /> Talk to a seller
              </Link>
            </div>
          </motion.div>
        )}

        <div className="mt-6 flex flex-col items-start gap-3 rounded-[16px] border border-border bg-[var(--blue-tint)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="mb-1 font-heading text-[15px] font-bold tracking-tight text-foreground">
              Question not here?
            </h3>
            <p className="m-0 text-[13px] text-muted-foreground">
              Message the seller from any store page — real people answer.
            </p>
          </div>
          <Link
            href="/discover"
            className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground no-underline"
          >
            <MessageCircle size={15} /> Find a store
          </Link>
        </div>
      </div>
    </div>
  );
}
