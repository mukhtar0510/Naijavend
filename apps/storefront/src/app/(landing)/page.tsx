import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, ClipboardList, MapPin, MessageCircle, PackageCheck, Store, Truck } from 'lucide-react';

import { BRAND } from '@idevtenancy/shared';
import { KwaravendLogoMark } from '@/components/KwaravendLogo';

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} — storefronts in ${BRAND.launchRegion.city}` },
  description: BRAND.description,
};

export const revalidate = 3600;

/**
 * Seller stories are rendered only when real, consented stories exist in this
 * array. It is empty on purpose: inventing testimonials is not allowed.
 */
const SELLER_STORIES: Array<{ name: string; business: string; area: string; quote: string }> = [];

const STEPS = [
  {
    Icon: Store,
    title: 'Open your store',
    text: 'Add your name, WhatsApp number, Ilorin area and first products. No card, no setup fee.',
  },
  {
    Icon: MessageCircle,
    title: 'Share one link',
    text: 'Post it on WhatsApp, Instagram or a QR sticker. Buyers see prices, hours and how to find you.',
  },
  {
    Icon: PackageCheck,
    title: 'Take orders',
    text: 'Buyers order and pick pickup or delivery. You confirm the order and mark it paid when the money lands.',
  },
];

const OUTCOMES = [
  {
    Icon: Store,
    title: 'Sell',
    text: 'A real store page with your catalogue, prices, hours and a shareable link — instead of screenshots in DMs.',
  },
  {
    Icon: ClipboardList,
    title: 'Manage',
    text: 'Orders, stock, customers and pickup/delivery in one dashboard. Bank transfers are confirmed by you, not assumed.',
  },
  {
    Icon: Truck,
    title: 'Deliver',
    text: 'Delivery zones by Ilorin area, a fee the buyer sees up front, and a tracking page they can check themselves.',
  },
];

const FAQS = [
  {
    q: 'How much does it cost?',
    a: 'The Free plan costs nothing and has no end date. Paid plans are ₦3,000, ₦8,000 and ₦15,000 a month. There is no commission on your sales, and online billing is not switched on yet, so nothing is charged today.',
  },
  {
    q: 'Can I take payments online?',
    a: 'Not yet. Buyers choose cash on delivery, bank transfer or pay on pickup. For a transfer, you confirm the money arrived before the order is marked paid. Kwaravend never calls an unpaid order "paid".',
  },
  {
    q: 'Where does Kwaravend work?',
    a: `Kwaravend is launching in ${BRAND.launchRegion.city}, ${BRAND.launchRegion.state} State. Store addresses must be in an Ilorin area. Sellers elsewhere can join the waitlist.`,
  },
  {
    q: 'Do I need a laptop?',
    a: 'No. Everything is built mobile-first: adding products, confirming orders and updating a delivery all work on a phone.',
  },
];

function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 max-w-[640px]">
      <div className="mb-3">{eyebrow}</div>
      <h2 className="mb-2 font-heading text-[clamp(23px,3.4vw,32px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground">
        {title}
      </h2>
      {children ? (
        <p className="m-0 max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground">{children}</p>
      ) : null}
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="brand">
      {/* ================================ HERO ================================ */}
      <section className="brand-hero">
        <div className="brand-hero-grid" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-12 sm:px-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pb-20 lg:pt-16">
          <div className="relative z-10">
            <span className="brand-eyebrow">
              <span className="brand-eyebrow-dot" aria-hidden>
                <MapPin size={11} />
              </span>
              {BRAND.launchRegion.city}, {BRAND.launchRegion.state} State
            </span>

            <h1 className="mb-4 mt-5 font-heading text-[clamp(32px,5.2vw,56px)] font-extrabold leading-[1.08] tracking-[-0.04em] text-foreground">
              Your business deserves more than a <span className="brand-grad">WhatsApp catalogue.</span>
            </h1>

            <p className="brand-hero-lede mb-7">
              Kwaravend gives {BRAND.launchRegion.city} sellers a real store page buyers can find nearby — with
              prices, pickup or delivery, and a tracking link. Start free, upgrade when it pays for itself.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="btn btn-primary btn-lg">
                Open your store, free <ArrowRight size={17} />
              </Link>
              <Link href="/discover" className="btn btn-outline btn-lg">
                Browse stores
              </Link>
            </div>

            <div className="brand-trust-cards mt-6">
              <span className="brand-trust-card">
                <Check size={14} /> No card to start
              </span>
              <span className="brand-trust-card">
                <Check size={14} /> No commission
              </span>
              <span className="brand-trust-card">
                <Check size={14} /> Pickup or delivery
              </span>
            </div>
          </div>

          <div className="relative z-0">
            {/* A plain illustrative card, not a screenshot of a live store. */}
            <div className="rounded-[20px] border border-border bg-card p-5 shadow-[0_26px_60px_-34px_rgba(15,23,42,0.45)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Buyer view
                </span>
                <span className="badge badge-blue">Ilorin</span>
              </div>
              <h3 className="mb-1 font-heading text-[17px] font-bold tracking-tight text-foreground">
                What a buyer sees
              </h3>
              <p className="mb-4 text-[13.5px] leading-relaxed text-muted-foreground">
                Your catalogue, your prices, your area — and one button to order or ask on WhatsApp.
              </p>
              <div className="grid gap-2">
                {['Products with prices', 'Pickup or delivery fee', 'Order status link'].map((line) => (
                  <div
                    key={line}
                    className="flex items-center gap-2.5 rounded-[10px] border border-border bg-[var(--elevated)] px-3 py-2 text-[12.5px] font-semibold text-foreground"
                  >
                    <Check size={14} style={{ color: 'var(--success)' }} />
                    {line}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-muted-foreground">
                Orders are created on our server, so prices and stock are checked again before anything is
                confirmed.
              </p>
            </div>
          </div>
        </div>
        <div className="brand-hero-fade" aria-hidden />
      </section>

      {/* ============================ HOW IT WORKS =========================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-7 lg:py-14" aria-labelledby="how-title">
        <h2
          id="how-title"
          className="mb-6 max-w-[560px] font-heading text-[clamp(22px,3.2vw,30px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground"
        >
          From a WhatsApp catalogue to a real store in three steps.
        </h2>
        <div className="brand-steps">
          {STEPS.map(({ Icon, title, text }) => (
            <div key={title} className="brand-step">
              <span className="brand-step-ico" aria-hidden>
                <Icon size={17} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================== OUTCOMES ============================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-7 lg:py-16">
        <SectionHead eyebrow={<span className="badge badge-gold">Outcomes</span>} title="Sell, manage, deliver">
          One place for the three things a small business actually has to do.
        </SectionHead>
        <div className="grid gap-3 sm:grid-cols-3">
          {OUTCOMES.map(({ Icon, title, text }) => (
            <div key={title} className="brand-card-lift rounded-[16px] border border-border bg-card p-5">
              <span className="brand-icon-tile mb-3">
                <Icon size={18} />
              </span>
              <h3 className="mb-1 font-heading text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
              <p className="m-0 text-[13.5px] leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ SELLER STORIES ========================== */}
      {SELLER_STORIES.length > 0 ? (
        <section className="border-y border-border bg-[var(--elevated)]">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-7 lg:py-16">
            <SectionHead eyebrow={<span className="badge">Seller stories</span>} title="From sellers in Ilorin">
              Real stores, in their own words.
            </SectionHead>
            <div className="grid gap-3 sm:grid-cols-3">
              {SELLER_STORIES.map((story) => (
                <blockquote key={story.business} className="m-0 rounded-[16px] border border-border bg-card p-5">
                  <p className="m-0 text-[14px] leading-relaxed text-foreground">“{story.quote}”</p>
                  <footer className="mt-3 text-[12.5px] text-muted-foreground">
                    {story.name} · {story.business} · {story.area}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* =============================== PRICING ============================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-7 lg:py-16">
        <SectionHead eyebrow={<span className="badge badge-gold">Pricing</span>} title="Monthly plans. No commission.">
          Priced in naira, billed per month, with no cut of your sales. Online billing is not switched on yet.
        </SectionHead>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[16px] border border-border bg-card p-5">
            <h3 className="mb-1 font-heading text-[16px] font-bold text-foreground">Free</h3>
            <p className="mb-1 font-mono text-[26px] font-bold text-foreground">₦0</p>
            <p className="mb-3 text-[12px] font-semibold text-muted-foreground">forever, no card</p>
            <ul className="m-0 grid list-none gap-2 p-0 text-[13px] text-muted-foreground">
              {[
                'Store page and share link',
                'Up to 25 listings',
                'Guest orders and pickup/delivery',
                'Bank transfer confirmation',
                'Order tracking link',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/dashboard" className="btn btn-primary mt-5 w-full justify-center">
              Open your store
            </Link>
          </div>
          <div className="rounded-[16px] border border-border bg-card p-5">
            <h3 className="mb-1 font-heading text-[16px] font-bold text-foreground">Business</h3>
            <p className="mb-1 font-mono text-[26px] font-bold text-foreground">₦3,000</p>
            <p className="mb-2 text-[12px] font-semibold text-muted-foreground">per month · not yet on sale</p>
            <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
              For a shop selling every week: up to 100 listings, staff accounts, deeper analytics. Nothing is charged
              today.
            </p>
          </div>
          <div className="rounded-[16px] border border-dashed border-border-strong bg-[var(--elevated)] p-5">
            <h3 className="mb-1 font-heading text-[16px] font-bold text-foreground">Business Plus</h3>
            <p className="mb-1 font-mono text-[26px] font-bold text-foreground">₦8,000</p>
            <p className="mb-2 text-[12px] font-semibold text-muted-foreground">per month · not yet on sale</p>
            <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
              Customer CRM, multiple locations and more rider tools. Nothing is charged today.
            </p>
          </div>
          <div className="rounded-[16px] border border-dashed border-border-strong bg-[var(--elevated)] p-5">
            <h3 className="mb-1 font-heading text-[16px] font-bold text-foreground">Business Pro</h3>
            <p className="mb-1 font-mono text-[26px] font-bold text-foreground">₦15,000</p>
            <p className="mb-2 text-[12px] font-semibold text-muted-foreground">per month · not yet on sale</p>
            <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
              Custom domain, unlimited listings and advanced dispatch. Nothing is charged today.
            </p>
          </div>
        </div>
        <Link href="/pricing" className="btn btn-outline mt-5">
          See the full plan comparison <ArrowRight size={16} />
        </Link>
      </section>

      {/* ================================= FAQ ================================ */}
      <section className="border-t border-border bg-[var(--elevated)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-7 lg:py-16">
          <SectionHead eyebrow={<span className="badge">Straight answers</span>} title="Questions sellers ask first">
            Short answers. The full FAQ has the rest.
          </SectionHead>
          <div className="grid gap-2.5">
            {FAQS.map((item) => (
              <details key={item.q} className="rounded-[14px] border border-border bg-card px-4 py-3.5">
                <summary className="cursor-pointer text-[14px] font-semibold text-foreground">{item.q}</summary>
                <p className="mb-0 mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
          <Link href="/faq" className="btn btn-outline mt-5">
            Open the full FAQ <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* =============================== CLOSING =============================== */}
      <section className="px-5 py-16 sm:px-7">
        <div className="mx-auto w-full max-w-4xl rounded-[24px] border border-border bg-card px-6 py-12 text-center sm:px-10">
          <div className="mb-4 flex justify-center">
            <KwaravendLogoMark size={44} />
          </div>
          <h2 className="mb-3 font-heading text-[clamp(23px,3.8vw,34px)] font-extrabold leading-[1.08] tracking-[-0.04em] text-foreground">
            Give your customers somewhere to land.
          </h2>
          <p className="mx-auto mb-6 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
            Keep your WhatsApp. Add a storefront that answers the price, hours and delivery questions for you.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="btn btn-primary btn-lg">
              Start selling <ArrowRight size={17} />
            </Link>
            <Link href="/discover" className="btn btn-outline btn-lg">
              Browse stores
            </Link>
          </div>
          <p className="mt-5 text-[12px] text-muted-foreground">
            Made in Nigeria  · free to start · no commission
          </p>
        </div>
      </section>
    </main>
  );
}
