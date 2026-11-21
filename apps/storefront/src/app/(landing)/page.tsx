import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, ClipboardList, Map as MapIcon, MessageCircle, PackageCheck, Star, Store, Truck } from 'lucide-react';
import { HeroMockup } from '@/components/landing/HeroMockup';

import {
  BRAND,
  HERO_PILLS,
  HERO_PRIMARY_CTA,
  HERO_SECONDARY_CTA,
  HERO_SUB,
  STARTER_TEMPLATE_COUNT,
  heroHeadlineLines,
} from '@idevtenancy/shared';
import { KwaravendLogoMark } from '@/components/KwaravendLogo';
import { SceneMount, ReduceEffectsMount } from '@/components/landing/SceneMount';
import { PlanCards } from '@/components/landing/PlanCards';
import { StoreDesigner } from '@/components/brand/StoreDesigner';

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
      {/* The street scene is decoration (aria-hidden, lazy); every word below is real HTML. */}
      {/* REDESIGN_V2 §5.1 hero reference: grid + blue glow, copy left, example
          storefront mockup right. Copy is server HTML (the LCP element); its
          rise-in is CSS so it paints immediately. */}
      <section className="kvh" aria-labelledby="hero-title">
        <div className="kvh-bg" aria-hidden />
        <div className="kvh-inner">
          <div className="kvh-copy">
            <span className="kvh-badge kvh-rise" style={{ ['--i' as string]: 0 }}>
              <Star size={13} aria-hidden className="kvh-star" />
              {BRAND.name}, built in {BRAND.launchRegion.city}
            </span>
            <h1 id="hero-title" className="kvh-title">
              {/* Locked copy (packages/shared/src/locked-copy.ts): HERO_HEADLINE with a gold "more". */}
              {heroHeadlineLines().map((line, li) => (
                <span key={li}>
                  <span className="kvh-rise" style={{ ['--i' as string]: li + 1 }}>
                    {line.map((w, wi) => (
                      <span key={wi}>
                        {wi > 0 ? ' ' : ''}
                        {w.gold ? <span className="kvh-gold">{w.text}</span> : w.text}
                      </span>
                    ))}
                  </span>{' '}
                </span>
              ))}
            </h1>
            <p className="kvh-sub kvh-rise" style={{ ['--i' as string]: 5 }}>
              {HERO_SUB}
            </p>
            <div className="kvh-actions kvh-rise" style={{ ['--i' as string]: 6 }}>
              <Link href="/dashboard" className="btn btn-primary btn-lg">
                {HERO_PRIMARY_CTA} <ArrowRight size={17} aria-hidden />
              </Link>
              <Link href="/map" className="btn btn-outline btn-lg">
                {HERO_SECONDARY_CTA}
              </Link>
            </div>
            <Link href="/about" className="kvh-story kvh-rise" style={{ ['--i' as string]: 7 }}>
              Read the {BRAND.name} story <ArrowRight size={15} aria-hidden />
            </Link>
            <ul className="kvh-checks kvh-rise" style={{ ['--i' as string]: 8 }}>
              {HERO_PILLS.map((c) => (
                <li key={c}>
                  <Check size={14} aria-hidden /> {c}
                </li>
              ))}
            </ul>
          </div>
          <HeroMockup />
        </div>
      </section>

      {/* ============================ HOW IT WORKS =========================== */}
      {/* The 100-layer street scene ("Ilorin at blue hour") unfolds here, below
          the hero, so the hero stays as clean as the reference. */}
      <section className="lx-hero lx-scene-band" aria-labelledby="how-title">
        <SceneMount />
        <div className="lx-hero-inner">
          <div className="lx-hero-copy">
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
          </div>
        </div>
        <div className="lx-tools">
          <ReduceEffectsMount />
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

      {/* ======================== STOREFRONT DESIGNER ====================== */}
      {/* Sample designer (illustrative only: never reads or writes a real store). */}
      <section className="lx-chapter mx-auto w-full max-w-6xl px-5 py-12 sm:px-7" id="designer" aria-labelledby="designer-title">
        <div className="sdg-band">
          <div className="nv-section-head sdg-band-head">
            <div>
              <span className="badge badge-warning">Storefront designer</span>
              <h2 id="designer-title" className="mb-2 mt-3 font-heading text-[clamp(22px,3vw,30px)] font-extrabold tracking-[-0.03em] text-foreground">
                Preview your store page and pick a template
              </h2>
              <p className="m-0 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
                Every plan starts with {STARTER_TEMPLATE_COUNT} templates. Type a vibe and the AI theme designer drafts
                the colours, fonts and layout. This is a sample: open your free store to save a design.
              </p>
            </div>
            <Link href="/dashboard" className="btn btn-primary">
              Design my store <ArrowRight size={16} />
            </Link>
          </div>
          <StoreDesigner />
        </div>
      </section>

      {/* ======================== FIND STORES NEAR YOU ======================= */}
      <section className="lx-chapter mx-auto w-full max-w-6xl px-5 py-10 sm:px-7" aria-labelledby="near-title">
        <div className="lx-map-card">
          <div>
            <span className="badge badge-primary">
              <MapIcon size={13} /> Live map
            </span>
            <h2 id="near-title" className="mb-2 mt-3 font-heading text-[clamp(22px,3vw,30px)] font-extrabold tracking-[-0.03em] text-foreground">
              Find stores near you in {BRAND.launchRegion.city}
            </h2>
            <p className="m-0 max-w-[56ch] text-[15px] leading-relaxed text-muted-foreground">
              Open now, distance from your exact spot, directions and WhatsApp in one tap, with landmarks across
              Kwara: Unilorin, Al-Hikmah, KWASU, Kwara Mall, Offa and more. Stores marked Example show sample data
              until real sellers join.
            </p>
          </div>
          <Link href="/map" className="btn btn-primary btn-lg">
            Open the map <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* =============================== PRICING ============================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-7 lg:py-16">
        <SectionHead eyebrow={<span className="badge badge-gold">Pricing</span>} title="Monthly plans. No commission.">
          Priced in naira, billed per month, with no cut of your sales. Online billing is not switched on yet.
        </SectionHead>
        <PlanCards />
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
            Made in Nigeria · free to start · no commission
          </p>
        </div>
      </section>
    </main>
  );
}
