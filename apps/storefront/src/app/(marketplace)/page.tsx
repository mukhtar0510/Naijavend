import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  Layers,
  MapPin,
  MessageCircle,
  Monitor,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';

import { NaijavendLogoMark } from '@/components/NaijavendLogo';
import { Stars } from '@/components/Stars';
import { OpenBadge } from '@/components/OpenBadge';
import { VerifiedTick } from '@/components/VerifiedTick';
import { formatHours } from '@/lib/hours';

import { CountUp, Marquee, Reveal, ScrollProgress, Stagger, StaggerItem, Tilt } from '@/components/brand/Motion';
import { HeroScene } from '@/components/brand/HeroScene';
import { LayerStack } from '@/components/brand/LayerStack';
import { AudienceTabs } from '@/components/brand/AudienceTabs';
import { StoryTimeline } from '@/components/brand/StoryTimeline';
import { MARKET, PERSONAS, POPULAR, PRINCIPLES, TRUST } from '@/lib/brand-copy';

// Trust rules carry an icon key so both brand pages can render the same set.
const TRUST_ICONS = {
  badge: BadgeCheck,
  star: Star,
  pin: MapPin,
  shield: ShieldCheck,
} as const;

export const metadata: Metadata = {
  // Absolute: the layout template would otherwise append "· Naijavend" twice
  // and browsers cut the tab title off.
  title: { absolute: 'Naijavend — storefronts for Nigerian business' },
  description:
    'Every Nigerian seller deserves a storefront as good as their hustle. Naijavend gives each business a real website — catalogue, orders, bookings, free POS, staff, branches, a live map — then puts it in front of buyers. Open a free store or shop the marketplace.',
};

export const revalidate = 3600;

const DEMO_HOURS = {
  mon: ['09:00', '18:00'],
  tue: ['09:00', '18:00'],
  wed: ['09:00', '18:00'],
  thu: ['09:00', '18:00'],
  fri: ['09:00', '20:00'],
  sat: ['10:00', '20:00'],
} as const;
const demoHoursRows = formatHours(DEMO_HOURS as unknown as Record<string, [string, string] | null>) ?? [];

function SectionHead({
  eyebrow,
  title,
  children,
  center = true,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? 'mx-auto mb-9 max-w-[680px] text-center' : 'mb-9 max-w-[680px]'}>
      {eyebrow ? <div className="mb-3">{eyebrow}</div> : null}
      <h2 className="mb-2 font-heading text-[clamp(24px,3.6vw,36px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground">
        {title}
      </h2>
      {children ? (
        <p className="mx-auto text-[15px] leading-relaxed text-muted-foreground" style={{ maxWidth: '58ch' }}>
          {children}
        </p>
      ) : null}
    </div>
  );
}

export default function BrandLandingPage() {
  return (
    <main className="brand">
      <ScrollProgress />

      {/* ================================ HERO ================================ */}
      <section className="brand-hero">
        <div className="brand-hero-grid" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pb-24 lg:pt-20">
          <div className="relative z-10">
            <Reveal>
              <span className="brand-eyebrow">
                <span className="brand-eyebrow-dot" aria-hidden>
                  <Sparkles size={11} />
                </span>
                Naijavend · built in Nigeria
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mb-4 mt-5 font-heading text-[clamp(34px,5.4vw,60px)] font-extrabold leading-[1.08] tracking-[-0.04em] text-foreground">
                Every Nigerian business deserves a storefront as good as its{' '}
                <span className="brand-grad">hustle.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="brand-hero-lede mb-7">
                Turn your WhatsApp catalogue into a real store. Orders, bookings, free POS. 0% commission.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard" className="btn btn-primary btn-lg">
                  Open your store — free <ArrowRight size={17} />
                </Link>
                <Link href="/home" className="btn btn-outline btn-lg">
                  Enter the marketplace
                </Link>
              </div>
              <Link
                href="/about"
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground no-underline hover:text-[var(--blue)]"
              >
                Read the Naijavend story <ArrowUpRight size={14} />
              </Link>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="brand-trust-cards">
                <span className="brand-trust-card">
                  <Check size={14} /> No card to start
                </span>
                <span className="brand-trust-card">
                  <Check size={14} /> 0% commission
                </span>
                <span className="brand-trust-card">
                  <Check size={14} /> POS &amp; staff included
                </span>
              </div>
            </Reveal>
          </div>

          <div className="relative z-0 lg:pl-4">
            <HeroScene />
          </div>
        </div>
        <div className="brand-hero-fade" aria-hidden />
      </section>

      {/* ============================ HOW IT WORKS =========================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-7 lg:py-14" aria-labelledby="how-title">
        <div className="mb-6 max-w-[560px]">
          <span className="badge mb-3">How it works</span>
          <h2
            id="how-title"
            className="m-0 font-heading text-[clamp(22px,3.2vw,30px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground"
          >
            From a WhatsApp catalogue to a real store in three steps.
          </h2>
        </div>
        <div className="brand-steps">
          {[
            {
              Icon: Store,
              title: 'Open your store',
              text: 'Add your logo, hours, WhatsApp number and first listings. Free, no card.',
            },
            {
              Icon: MessageCircle,
              title: 'Share one link',
              text: 'Post it on WhatsApp, Instagram or a QR sticker. Buyers see prices, hours and your address.',
            },
            {
              Icon: BadgeCheck,
              title: 'Get paid and reviewed',
              text: 'Take orders or bookings, then let real customers build your public ranking.',
            },
          ].map(({ Icon, title, text }) => (
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

      {/* ============================== MARQUEE ============================== */}
      <section className="border-b border-border bg-surface" aria-label="What is included">
        <Marquee
          items={MARKET.map((item) => (
            <span key={item}>{item}</span>
          ))}
        />
      </section>

      {/* =============================== STATS =============================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-7">
        <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StaggerItem>
            <div className="brand-stat">
              <span className="brand-stat-value">
                <CountUp to={0} prefix="₦" />
              </span>
              <span className="brand-stat-label">To open a store — no subscription, no card.</span>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="brand-stat">
              <span className="brand-stat-value">24/7</span>
              <span className="brand-stat-label">Your storefront stays open, with live hours for buyers.</span>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="brand-stat">
              <span className="brand-stat-value">
                <CountUp to={1} />
              </span>
              <span className="brand-stat-label">Link for catalogue, bookings, chat, reviews and QR.</span>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="brand-stat">
              <span className="brand-stat-value">
                <CountUp to={5} />
              </span>
              <span className="brand-stat-label">Layers in one storefront — identity to reach.</span>
            </div>
          </StaggerItem>
        </Stagger>
      </section>

      {/* ============================= MANIFESTO ============================= */}
      <section className="border-y border-border bg-[var(--elevated)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-7 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:py-20">
          <div>
            <Reveal>
              <span className="badge badge-blue mb-4">
                <Layers size={13} /> What we believe
              </span>
              <h2 className="mb-4 font-heading text-[clamp(26px,4vw,42px)] font-extrabold leading-[1.03] tracking-[-0.04em] text-foreground">
                We think one link should be able to <span className="brand-grad">run a business.</span>
              </h2>
              <p className="m-0 max-w-[48ch] text-[15.5px] leading-relaxed text-muted-foreground">
                Nigerian commerce already works on trust, speed and WhatsApp. It doesn’t need a heavier version of
                that — it needs a shopfront that keeps up, and a marketplace where the work is visible.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-7 flex flex-wrap gap-2">
                <span className="badge">Reviews from real orders</span>
                <span className="badge">Server-verified prices</span>
                <span className="badge">WhatsApp-first</span>
                <span className="badge">Data-light</span>
              </div>
            </Reveal>
          </div>

          <div className="grid gap-3">
            {PRINCIPLES.map((principle, index) => (
              <Reveal key={principle.k} delay={index * 0.06}>
                <div className="brand-card-lift grid grid-cols-[48px_1fr] gap-4 rounded-[16px] border border-border bg-card p-5">
                  <span
                    className="font-heading text-[22px] font-extrabold leading-none"
                    style={{
                      letterSpacing: '-0.04em',
                      background: 'linear-gradient(160deg, var(--blue), var(--brand-violet))',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    }}
                  >
                    {principle.k}
                  </span>
                  <div>
                    <h3 className="mb-1 font-heading text-[15.5px] font-bold tracking-tight text-foreground">
                      {principle.title}
                    </h3>
                    <p className="m-0 text-[13.5px] leading-relaxed text-muted-foreground" style={{ maxWidth: '52ch' }}>
                      {principle.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================================ STORY =============================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16">
          <div>
            <Reveal>
              <span className="badge mb-4">Our story</span>
              <h2 className="mb-5 font-heading text-[clamp(24px,3.4vw,34px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-foreground">
                It started with a price list pasted into fifty DMs.
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <div className="grid gap-4 text-[15px] leading-relaxed text-muted-foreground" style={{ maxWidth: '62ch' }}>
                <p className="m-0">
                  Nigerian sellers were already running serious businesses — just split across a WhatsApp catalogue,
                  an Instagram grid and a notebook of orders. Every new customer meant the same five questions, the
                  same screenshots, the same “send your address”.
                </p>
                <p className="m-0">
                  Naijavend exists to give that work a place to live. A store page holds the facts once: what you
                  sell, what it costs, when you’re open, where you are. Buyers get answers without asking, and
                  sellers get a link they can hand to anyone.
                </p>
                <p className="m-0">
                  Then we kept going — bookings, a counter POS, staff logins, branches, a live map, honest rankings
                  and the blue tick — because a storefront that only sells is a brochure, not a business.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="brand-pull mt-7">
                “A seller should not need a developer to look established — and a buyer should not need luck to find
                someone real.”
              </div>
              <p className="mt-3 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                — The Naijavend team
              </p>
            </Reveal>
          </div>

          {/* Layered order card (2.5D) */}
          <Reveal delay={0.08}>
            <Tilt className="relative mx-auto w-full max-w-[400px]">
              <div
                aria-hidden
                className="absolute inset-0 rounded-[22px] border border-border"
                style={{
                  transform: 'translate3d(0, 18px, -40px) rotate(1.6deg)',
                  background: 'var(--elevated)',
                }}
              />
              <div
                aria-hidden
                className="absolute inset-0 rounded-[22px] border border-border"
                style={{
                  transform: 'translate3d(0, 9px, -20px) rotate(0.8deg)',
                  background: 'var(--surface)',
                }}
              />
              <div className="relative rounded-[22px] border border-border bg-card p-5 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.45)]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Order · NV-1042
                    </span>
                    <h3 className="mt-1 font-heading text-[17px] font-bold tracking-tight text-foreground">
                      Amaka Glow Studio
                    </h3>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <MapPin size={12} /> Lekki Phase 1, Lagos
                    </span>
                  </div>
                  <span className="badge badge-success">Confirmed</span>
                </div>

                <div className="grid gap-2 rounded-[14px] border border-border bg-[var(--elevated)] p-3">
                  {[
                    { name: 'Shea body butter ×2', price: '₦17,000' },
                    { name: 'Silk press (Saturday, 11:00)', price: '₦15,000' },
                    { name: 'Promo · GLOW20', price: '−₦4,000' },
                  ].map((line) => (
                    <div key={line.name} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="text-muted-foreground">{line.name}</span>
                      <span className="font-mono font-semibold text-foreground">{line.price}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-[13px]">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--blue)' }}>
                      ₦28,000
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <VerifiedTick size={14} /> Verified seller
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#25d366] px-3 py-2 text-[11.5px] font-bold text-[#06130a]">
                    <MessageCircle size={13} /> Sent on WhatsApp
                  </span>
                </div>
              </div>
            </Tilt>
          </Reveal>
        </div>
      </section>

      {/* ============================ THE LAYERS ============================ */}
      <section className="border-y border-border bg-[var(--elevated)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
          <SectionHead
            eyebrow={
              <span className="badge badge-black">
                <Layers size={13} /> The stack
              </span>
            }
            title={
              <>
                Five layers deep, <span className="brand-grad">one storefront.</span>
              </>
            }
          >
            Tap a layer to see what it holds. Every layer is already live on seller stores — nothing here is a
            mock-up of a future plan.
          </SectionHead>
          <LayerStack />
        </div>
      </section>

      {/* ============================== AUDIENCE ============================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
        <SectionHead
          eyebrow={<span className="badge">Built for both sides</span>}
          title={
            <>
              A shopfront for sellers. A shortlist for <span className="brand-grad">buyers.</span>
            </>
          }
        >
          The same store data powers both experiences — so what a seller updates is exactly what a buyer sees.
        </SectionHead>
        <Reveal>
          <AudienceTabs />
        </Reveal>
      </section>

      {/* =========================== LIVE COMPONENTS ========================== */}
      <section className="border-y border-border bg-[var(--elevated)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
          <SectionHead
            eyebrow={<span className="badge badge-blue">2D · real components</span>}
            title="The pieces buyers actually touch"
            center={false}
          >
            These are live components from store pages, rendered here with sample data — not screenshots.
          </SectionHead>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* Opening hours */}
            <Reveal className="md:col-span-2 xl:col-span-2">
              <div className="brand-card-lift h-full rounded-[16px] border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="m-0 font-heading text-[15.5px] font-bold tracking-tight text-foreground">
                    Opening &amp; closing
                  </h3>
                  <OpenBadge hours={DEMO_HOURS as unknown as Record<string, [string, string] | null>} />
                </div>
                <p className="mb-4 text-[13.5px] leading-relaxed text-muted-foreground">
                  Open/Closed is computed live from the seller&apos;s weekly hours, so buyers never turn up to a shut
                  door wondering.
                </p>
                <table className="hours-table w-full max-w-[320px] text-[13px]">
                  <tbody>
                    {demoHoursRows.map((row) => (
                      <tr key={row.day}>
                        <td className="text-muted-foreground">{row.day}</td>
                        <td className="text-right font-medium text-foreground">{row.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>

            {/* Reviews */}
            <Reveal delay={0.06}>
              <div className="brand-card-lift h-full rounded-[16px] border border-border bg-card p-5">
                <h3 className="mb-1 font-heading text-[15.5px] font-bold tracking-tight text-foreground">
                  Verified ratings
                </h3>
                <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
                  Stars only after a real order or booking.
                </p>
                <div className="rounded-[12px] border border-dashed border-border-strong bg-[var(--elevated)] px-4 py-5 text-center">
                  <Stars value={4.6} />
                  <p className="mx-auto mb-3 mt-2 max-w-[26ch] text-[12px] text-muted-foreground">
                    4.6 average · 38 reviews · purchases only
                  </p>
                  <span className="badge badge-blue">
                    Verified <VerifiedTick size={13} />
                  </span>
                </div>
              </div>
            </Reveal>

            {/* Order & booking flow */}
            <Reveal delay={0.1}>
              <div className="brand-card-lift h-full rounded-[16px] border border-border bg-card p-5">
                <h3 className="mb-1 font-heading text-[15.5px] font-bold tracking-tight text-foreground">
                  Order &amp; booking flow
                </h3>
                <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
                  Products ordered, services booked — prices re-checked server-side.
                </p>
                <div className="grid gap-2">
                  {[
                    { Icon: Store, label: 'Browse the store' },
                    { Icon: CalendarCheck, label: 'Order or pick a slot' },
                    { Icon: Wallet, label: 'Confirm on WhatsApp' },
                    { Icon: Users, label: 'Seller notified' },
                  ].map(({ Icon, label }, index) => (
                    <div
                      key={label}
                      className="flex items-center gap-2.5 rounded-[10px] border border-border bg-[var(--elevated)] px-3 py-2"
                    >
                      <span className="font-mono text-[10.5px] font-bold text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <Icon size={14} style={{ color: 'var(--blue)' }} />
                      <span className="text-[12.5px] font-semibold text-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Chat */}
            <Reveal delay={0.14} className="md:col-span-2 xl:col-span-4">
              <div className="brand-card-lift rounded-[16px] border border-border bg-card p-5">
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:items-center">
                  <div>
                    <h3 className="mb-1 font-heading text-[15.5px] font-bold tracking-tight text-foreground">
                      Chat &amp; WhatsApp, without the copy-paste
                    </h3>
                    <p className="m-0 text-[13.5px] leading-relaxed text-muted-foreground" style={{ maxWidth: '46ch' }}>
                      Ask in-app, or continue on WhatsApp with the question and the item already attached. The same
                      thread lives beside the order in the seller dashboard.
                    </p>
                  </div>
                  <div className="mx-auto grid w-full max-w-[420px] gap-2.5 rounded-[14px] border border-dashed border-border-strong bg-[var(--elevated)] p-4">
                    <div className="max-w-[85%] justify-self-start rounded-[14px] rounded-bl-[4px] border border-border bg-card px-3.5 py-2 text-[13px] text-foreground shadow-sm">
                      Is the 6-inch cake available on Saturday?
                    </div>
                    <div
                      className="max-w-[85%] justify-self-end rounded-[14px] rounded-br-[4px] px-3.5 py-2 text-[13px] text-white shadow-sm"
                      style={{ background: 'var(--blue)' }}
                    >
                      Yes! Order before Friday 6pm and we&apos;ll deliver. 🎂
                    </div>
                    <div className="justify-self-end rounded-[10px] bg-[#25d366] px-3 py-1.5 text-[11.5px] font-bold text-[#06130a]">
                      Order on WhatsApp
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================== TIMELINE ============================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
        <SectionHead
          eyebrow={<span className="badge">The journey</span>}
          title="From a DM to a dashboard"
        >
          How the product grew — each chapter is something you can use on a store today.
        </SectionHead>
        <StoryTimeline />
      </section>

      {/* ============================== PERSONAS ============================== */}
      <section className="border-y border-border bg-[var(--elevated)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
          <SectionHead
            eyebrow={<span className="badge badge-black">Who it’s for</span>}
            title={
              <>
                Built for the way Nigeria <span className="brand-grad">sells.</span>
              </>
            }
          >
            If it can be listed, booked or delivered, it can live on a Naijavend storefront.
          </SectionHead>

          <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" gap={0.05}>
            {PERSONAS.map((persona) => (
              <StaggerItem key={persona.title}>
                <div className="brand-card-lift h-full rounded-[16px] border border-border bg-card p-4">
                  <span aria-hidden className="mb-2 block text-[22px] leading-none">
                    {persona.ico}
                  </span>
                  <h3 className="mb-1 font-heading text-[14px] font-bold tracking-tight text-foreground">
                    {persona.title}
                  </h3>
                  <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">{persona.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* =============================== TRUST =============================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
          <Reveal>
            <span className="badge badge-blue mb-4">
              <ShieldCheck size={13} /> Trust, by design
            </span>
            <h2 className="mb-3 font-heading text-[clamp(24px,3.4vw,34px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-foreground">
              Reputation should be a record, not a sticker.
            </h2>
            <p className="m-0 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
              The marketplace only works if a blue tick means something and a star cannot be bought. Here is what we
              enforce, and where to check it.
            </p>
            <div className="mt-6 grid gap-2 text-[13.5px]">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Check size={14} style={{ color: 'var(--success)' }} /> Reviews require a purchase
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Check size={14} style={{ color: 'var(--success)' }} /> Rankings weight recency
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Check size={14} style={{ color: 'var(--success)' }} /> Location never leaves your browser
              </span>
            </div>
            <Link href="/faq" className="btn btn-outline mt-6">
              Read the FAQ
            </Link>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {TRUST.map(({ icon, title, body }, index) => {
              const Icon = TRUST_ICONS[icon];
              return (
              <Reveal key={title} delay={index * 0.06}>
                <div className="brand-card-lift h-full rounded-[16px] border border-border bg-card p-5">
                  <span className="brand-icon-tile mb-3">
                    <Icon size={18} />
                  </span>
                  <h3 className="mb-1 font-heading text-[14.5px] font-bold tracking-tight text-foreground">{title}</h3>
                  <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================== EXTRAS ============================== */}
      <section className="border-y border-border bg-[var(--elevated)]">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-14 sm:grid-cols-3 sm:px-7">
          {[
            {
              Icon: QrCode,
              title: 'QR for every store',
              text: 'Branded QR codes for shops, price tags and flyers — with the plain link underneath.',
              href: '/dashboard',
              cta: 'Get your QR',
            },
            {
              Icon: Monitor,
              title: 'Free POS terminal',
              text: 'Take cash, transfer or card at the counter and keep stock in sync with the storefront.',
              href: '/dashboard',
              cta: 'See the dashboard',
            },
            {
              Icon: Truck,
              title: 'Dropshipper mode',
              text: 'Sell supplier-shipped goods with an honest delivery window on every listing.',
              href: '/faq',
              cta: 'How it works',
            },
          ].map(({ Icon, title, text, href, cta }, index) => (
            <Reveal key={title} delay={index * 0.05}>
              <div className="brand-card-lift flex h-full flex-col rounded-[16px] border border-border bg-card p-5">
                <span className="brand-icon-tile mb-3">
                  <Icon size={18} />
                </span>
                <h3 className="mb-1 font-heading text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
                <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
                <Link
                  href={href}
                  className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-semibold no-underline"
                >
                  {cta} <ArrowUpRight size={14} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================ FAQ TEASER ============================ */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start lg:gap-14">
          <div>
            <span className="badge mb-4">Straight answers</span>
            <h2 className="mb-3 font-heading text-[clamp(24px,3.4vw,34px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-foreground">
              The questions buyers and sellers actually ask.
            </h2>
            <p className="m-0 max-w-[42ch] text-[15px] leading-relaxed text-muted-foreground">
              Costs, the blue tick, reviews, the map, privacy. The full FAQ is searchable and grouped by topic.
            </p>
            <Link href="/faq" className="btn btn-primary mt-6">
              Open the FAQ <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-2.5">
            {POPULAR.map((item, index) => (
              <Reveal key={item.q} delay={index * 0.04}>
                <Link
                  href={item.href}
                  className="group flex items-center justify-between gap-4 rounded-[14px] border border-border bg-card px-4 py-3.5 no-underline transition-colors hover:border-[color:rgba(29,78,216,0.45)] hover:bg-[var(--blue-tint)]"
                >
                  <span className="flex items-center gap-3 text-[14px] font-semibold text-foreground">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {item.q}
                  </span>
                  <ArrowUpRight
                    size={16}
                    className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--blue)]"
                  />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =============================== CLOSING =============================== */}
      <section className="px-5 pb-20 sm:px-7">
        <div
          className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[26px] border border-border px-6 py-14 text-center sm:px-10"
          style={{
            background:
              'radial-gradient(700px 340px at 18% -20%, rgba(29,78,216,0.20), transparent 62%), radial-gradient(600px 300px at 84% 120%, rgba(190,30,107,0.16), transparent 62%), var(--elevated)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(29,78,216,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(29,78,216,0.06) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(90% 80% at 50% 20%, #000 10%, transparent 72%)',
              WebkitMaskImage: 'radial-gradient(90% 80% at 50% 20%, #000 10%, transparent 72%)',
            }}
          />
          <div className="relative">
            <div className="mb-4 flex justify-center">
              <span
                style={{
                  display: 'inline-flex',
                  padding: 10,
                  borderRadius: 20,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 18px 40px -22px rgba(29,78,216,0.55)',
                }}
              >
                <NaijavendLogoMark size={46} />
              </span>
            </div>
            <h2 className="mb-3 font-heading text-[clamp(24px,4vw,38px)] font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground">
              Your customers are already online.
              <br />
              <span className="brand-grad">Give them somewhere to land.</span>
            </h2>
            <p className="mx-auto mb-6 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
              Open a store free in minutes. Keep your WhatsApp — add a storefront that answers before you do.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/dashboard" className="btn btn-primary btn-lg">
                Start selling <ArrowRight size={17} />
              </Link>
              <Link href="/discover" className="btn btn-outline btn-lg">
                Explore stores
              </Link>
            </div>
            <p className="mt-5 text-[12px] text-muted-foreground">Made in Nigeria 🇳🇬 · free to start · no commission</p>
          </div>
        </div>
      </section>
    </main>
  );
}
