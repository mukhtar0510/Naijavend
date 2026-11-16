import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';

import { Reveal, Marquee, ScrollProgress, Stagger, StaggerItem } from '@/components/brand/Motion';
import { StoryTimeline } from '@/components/brand/StoryTimeline';
import { MARKET, PERSONAS, PRINCIPLES, TRUST } from '@/lib/brand-copy';

export const metadata: Metadata = {
  title: 'About Naijavend — who we build for and what we believe',
  description:
    'The story behind Naijavend: why every Nigerian seller deserves a real storefront, the three principles we build by, the rules that make a blue tick mean something, and how the product grew.',
};

export const revalidate = 3600;

const TRUST_ICONS = {
  badge: BadgeCheck,
  star: Star,
  pin: MapPin,
  shield: ShieldCheck,
} as const;

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

/**
 * About page — built from the same brand elements as the front door at `/`:
 * the principles, trust rules and audience copy come from `lib/brand-copy`,
 * the journey rail is the shared `StoryTimeline`, and the closing CTA matches
 * the landing page. The front door sells the product; this page tells the story.
 */
export default function AboutPage() {
  return (
    <main className="brand">
      <ScrollProgress />

      {/* ================================ HERO ================================ */}
      <section className="brand-hero">
        <div className="brand-hero-grid" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-6xl items-start gap-10 px-5 pb-16 pt-14 sm:px-7 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-14 lg:pb-20 lg:pt-20">
          <div>
            <Reveal>
              <span className="brand-eyebrow">
                <span className="brand-eyebrow-dot" aria-hidden>
                  <Sparkles size={11} />
                </span>
                About Naijavend
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mb-4 mt-5 font-heading text-[clamp(34px,5vw,54px)] font-extrabold leading-[1.0] tracking-[-0.045em] text-foreground">
                We build the storefront layer for{' '}
                <span className="brand-grad">Nigerian business.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mb-6 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
                Naijavend is not a listings site. It is the place a seller&apos;s work lives: a real
                storefront with a catalogue, prices, hours, bookings, chat and reviews — plus the
                dashboard that runs the shop behind it.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="flex flex-wrap gap-3">
                <Link href="/home" className="btn btn-primary btn-lg">
                  Enter the marketplace <ArrowRight size={17} />
                </Link>
                <Link href="/dashboard" className="btn btn-outline btn-lg">
                  Open a store — free
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12.5px] font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Check size={14} style={{ color: 'var(--success)' }} /> Founded in Nigeria
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check size={14} style={{ color: 'var(--success)' }} /> 0% commission
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check size={14} style={{ color: 'var(--success)' }} /> Free to start
                </span>
              </div>
            </Reveal>
          </div>

          {/* The principles, straight from the front door. */}
          <div className="grid gap-3">
            {PRINCIPLES.map((principle, index) => (
              <Reveal key={principle.k} delay={index * 0.07}>
                <div className="brand-card-lift grid grid-cols-[42px_1fr] gap-4 rounded-[16px] border border-border bg-card p-4 sm:p-5">
                  <span
                    className="font-heading text-[20px] font-extrabold leading-none"
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
                    <h2 className="mb-1 font-heading text-[14.5px] font-bold tracking-tight text-foreground">
                      {principle.title}
                    </h2>
                    <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
                      {principle.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <div className="brand-hero-fade" aria-hidden />
      </section>

      {/* ============================== MARQUEE ============================== */}
      <section className="border-b border-border bg-surface" aria-label="What is included">
        <Marquee items={MARKET.map((item) => <span key={item}>{item}</span>)} />
      </section>

      {/* ================================ STORY =============================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-16">
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
                  Nigerian sellers were already running serious businesses — just split across a
                  WhatsApp catalogue, an Instagram grid and a notebook of orders. Every new customer
                  meant the same five questions, the same screenshots, the same “send your address”.
                </p>
                <p className="m-0">
                  Naijavend exists to give that work a place to live. A store page holds the facts
                  once: what you sell, what it costs, when you&apos;re open, where you are. Buyers get
                  answers without asking, and sellers get a link they can hand to anyone.
                </p>
                <p className="m-0">
                  Then we kept going — bookings, a counter POS, staff logins, branches, a live map,
                  honest rankings and the blue tick — because a storefront that only sells is a
                  brochure, not a business.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.08}>
            <div className="grid gap-3">
              <div className="brand-pull">
                “A seller should not need a developer to look established — and a buyer should not
                need luck to find someone real.”
              </div>
              <p className="m-0 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                — The Naijavend team
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="brand-stat">
                  <span className="brand-stat-value">0%</span>
                  <span className="brand-stat-label">commission on every sale</span>
                </div>
                <div className="brand-stat">
                  <span className="brand-stat-value">1</span>
                  <span className="brand-stat-label">link for the whole business</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== TIMELINE ============================== */}
      <section className="border-y border-border bg-[var(--elevated)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
          <SectionHead eyebrow={<span className="badge">The journey</span>} title="From a DM to a dashboard">
            How the product grew — each chapter is something you can use on a store today.
          </SectionHead>
          <StoryTimeline />
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
              The marketplace only works if a blue tick means something and a star cannot be bought.
              Here is what we enforce, and where to check it.
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
                    <h3 className="mb-1 font-heading text-[14.5px] font-bold tracking-tight text-foreground">
                      {title}
                    </h3>
                    <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================== PERSONAS ============================== */}
      <section className="border-y border-border bg-[var(--elevated)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-7 lg:py-20">
          <SectionHead
            eyebrow={<span className="badge badge-black">Who it&apos;s for</span>}
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

      {/* =============================== CLOSING =============================== */}
      <section className="px-5 py-16 sm:px-7">
        <div
          className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[26px] border border-border px-6 py-12 sm:px-10"
          style={{
            background:
              'radial-gradient(700px 340px at 18% -20%, rgba(29,78,216,0.20), transparent 62%), radial-gradient(600px 300px at 84% 120%, rgba(190,30,107,0.16), transparent 62%), var(--elevated)',
          }}
        >
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="mb-2 font-heading text-[clamp(22px,3.6vw,32px)] font-extrabold leading-[1.08] tracking-[-0.04em] text-foreground">
                See the marketplace for yourself.
              </h2>
              <p className="m-0 max-w-[48ch] text-[14px] leading-relaxed text-muted-foreground">
                Browse verified Nigerian stores, or open your own free storefront in minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/home" className="btn btn-primary btn-lg">
                Enter the marketplace <ArrowRight size={16} />
              </Link>
              <Link href="/dashboard" className="btn btn-outline btn-lg">
                Open a store <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
