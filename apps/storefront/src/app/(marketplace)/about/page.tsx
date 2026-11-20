import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Palette,
} from 'lucide-react';

import { BRAND, STARTER_TEMPLATE_COUNT, STORE_TEMPLATES } from '@idevtenancy/shared';
import { Reveal, Stagger, StaggerItem } from '@/components/brand/Motion';
import { StoryTimeline } from '@/components/brand/StoryTimeline';
import { MARKET, PERSONAS, PRINCIPLES, TRUST } from '@/lib/brand-copy';

export const metadata: Metadata = {
  title: 'About Kwaravend — who we build for and what we believe',
  description:
    'The story behind Kwaravend: why every Ilorin seller deserves a real storefront, the three principles we build by, the rules that make a blue tick mean something, and how the product grew.',
};

export const revalidate = 3600;

const TRUST_ICONS = {
  badge: BadgeCheck,
  star: Star,
  pin: MapPin,
  shield: ShieldCheck,
} as const;

const STARTER_TEMPLATES = STORE_TEMPLATES.slice(0, STARTER_TEMPLATE_COUNT);

function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="nv-section-head">
      <div>
        {eyebrow ? <div style={{ marginBottom: 6 }}>{eyebrow}</div> : null}
        <h2>{title}</h2>
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}

/**
 * About page — same storefront design language as /home: gold and Naija green
 * accents over the marketplace chrome, Ilorin-only copy, and a live template
 * preview strip that points at the designer on the home page.
 */
export default function AboutPage() {
  return (
    <main className="nv-home">
      {/* ================================ HERO ================================ */}
      <section className="nv-hero">
        <div className="nv-hero-canvas" aria-hidden>
          <span className="nv-hero-grid" />
          <span className="nv-hero-orb nv-orb-a" />
          <span className="nv-hero-orb nv-orb-b" />
        </div>
        <div className="container nv-hero-inner">
          <div className="nv-hero-copy">
            <Reveal>
              <span className="nv-pill">
                <span className="nv-pill-dot" aria-hidden />
                About · {BRAND.launchRegion.city}, {BRAND.launchRegion.state} State
              </span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="nv-hero-title">
                We build the storefront layer
                <br />
                <span className="nv-grad-text">for Ilorin business.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="nv-hero-sub">
                Kwaravend is not a listings site. It is the place a seller&apos;s work lives: a real
                storefront with a catalogue, prices, hours, bookings, chat and reviews — plus the
                dashboard that runs the shop behind it.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="nv-hero-ctas">
                <Link href="/home" className="btn btn-primary btn-lg">
                  Enter the marketplace <ArrowRight size={17} />
                </Link>
                <Link href="/dashboard" className="btn btn-outline btn-lg">
                  Open a store — free
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="nv-hero-proof">
                <p>
                  <strong>No commission · no card to start</strong>
                  <span>Free plan forever · paid tiers from ₦3,000/mo · Ilorin only</span>
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.16} className="nv-hero-preview-wrap">
            <div className="sdg-band">
              <div className="sdg-band-head nv-section-head">
                <div>
                  <span className="sdg-eyebrow">
                    <Palette size={13} aria-hidden /> Templates
                  </span>
                  <h2 style={{ fontSize: 20, margin: '6px 0 4px' }}>
                    {STARTER_TEMPLATE_COUNT} starter looks, live preview
                  </h2>
                  <p style={{ margin: 0 }}>
                    Every plan starts here. Tap through the full gallery and AI designer on the home page.
                  </p>
                </div>
              </div>
              <div className="sdg-tpl-grid" style={{ maxHeight: 'none', paddingRight: 0 }}>
                {STARTER_TEMPLATES.map((t) => (
                  <div key={t.id} className="sdg-tpl" aria-hidden>
                    <span className={`sdg-thumb sdg-${t.id}`}>
                      <span className="sdg-thumb-nav" />
                      <span className="sdg-thumb-hero" />
                      <span className="sdg-thumb-row">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                    <span className="sdg-tpl-name">{t.name}</span>
                    <span className="sdg-tpl-best">{t.bestFor}</span>
                  </div>
                ))}
              </div>
              <Link href="/home#designer" className="btn btn-primary" style={{ marginTop: 12 }}>
                Open the designer <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== TRUST BAR ============================= */}
      <section className="nv-trust" aria-label="What is included">
        <div className="container nv-trust-grid">
          {MARKET.slice(0, 4).map((item) => (
            <div key={item} className="nv-trust-item">
              <span className="nv-trust-ico" aria-hidden>
                <Check size={16} />
              </span>
              <div>
                <strong>{item}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="container nv-home-body">
        {/* ============================== STORY ============================== */}
        <section className="nv-section" aria-labelledby="story-title">
          <div className="nv-section-head">
            <div>
              <span className="sdg-eyebrow">Our story</span>
              <h2 id="story-title">It started with a price list pasted into fifty DMs.</h2>
              <p>
                Ilorin sellers were already running serious businesses — just split across a WhatsApp
                catalogue, an Instagram grid and a notebook of orders.
              </p>
            </div>
          </div>

          <div className="nv-steps">
            <div className="nv-step">
              <span className="nv-step-num" aria-hidden>
                01
              </span>
              <h3>One place for the facts</h3>
              <p>
                What you sell, what it costs, when you&apos;re open, where you are. Buyers get answers
                without asking, and sellers get a link they can hand to anyone.
              </p>
            </div>
            <div className="nv-step">
              <span className="nv-step-num" aria-hidden>
                02
              </span>
              <h3>Then we kept going</h3>
              <p>
                Bookings, a counter POS, staff logins, branches, a live Ilorin map, honest rankings
                and the blue tick — because a storefront that only sells is a brochure.
              </p>
            </div>
            <div className="nv-step">
              <span className="nv-step-num" aria-hidden>
                03
              </span>
              <h3>Still Kwara first</h3>
              <p>
                Every store address must be in an Ilorin area. We would rather serve one city
                properly than pretend to cover a country we have not walked.
              </p>
            </div>
          </div>
        </section>

        {/* ============================ PRINCIPLES =========================== */}
        <section className="nv-section" aria-labelledby="principles-title">
          <div className="nv-section-head">
            <div>
              <span className="sdg-eyebrow">
                <Sparkles size={13} aria-hidden /> Principles
              </span>
              <h2 id="principles-title">Three rules we build by</h2>
              <p>A seller should not need a developer to look established.</p>
            </div>
          </div>
          <Stagger className="nv-store-grid" gap={0.05}>
            {PRINCIPLES.map((principle) => (
              <StaggerItem key={principle.k}>
                <div className="nv-store-card" style={{ height: '100%' }}>
                  <div className="nv-store-body">
                    <span className="sdg-eyebrow" style={{ marginBottom: 8 }}>{principle.k}</span>
                    <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{principle.title}</h3>
                    <p className="nv-store-desc" style={{ margin: 0 }}>{principle.body}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* ============================== JOURNEY ============================ */}
        <section className="nv-section" aria-labelledby="journey-title">
          <SectionHead eyebrow={<span className="sdg-eyebrow">The journey</span>} title="From a DM to a dashboard">
            How the product grew — each chapter is something you can use on a store today.
          </SectionHead>
          <StoryTimeline />
        </section>

        {/* =============================== TRUST ============================= */}
        <section className="nv-section" aria-labelledby="trust-title">
          <SectionHead
            eyebrow={
              <span className="sdg-eyebrow">
                <ShieldCheck size={13} aria-hidden /> Trust, by design
              </span>
            }
            title="Reputation should be a record, not a sticker."
          >
            The marketplace only works if a blue tick means something and a star cannot be bought.
          </SectionHead>
          <div className="nv-trust-grid">
            {TRUST.map(({ icon, title, body }) => {
              const Icon = TRUST_ICONS[icon];
              return (
                <div key={title} className="nv-trust-item">
                  <span className="nv-trust-ico" aria-hidden>
                    <Icon size={17} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/faq" className="btn btn-outline" style={{ marginTop: 14 }}>
            Read the FAQ
          </Link>
        </section>

        {/* ============================== PERSONAS =========================== */}
        <section className="nv-section" aria-labelledby="personas-title">
          <SectionHead eyebrow={<span className="sdg-eyebrow">Who it&apos;s for</span>} title="Built for the way Ilorin sells.">
            If it can be listed, booked or delivered, it can live on a Kwaravend storefront.
          </SectionHead>
          <Stagger className="nv-store-grid" gap={0.04}>
            {PERSONAS.map((persona) => (
              <StaggerItem key={persona.title}>
                <div className="nv-cat-tile" style={{ cursor: 'default' }}>
                  <span className="nv-cat-emoji" aria-hidden>
                    <persona.ico size={22} aria-hidden />
                  </span>
                  <span className="nv-cat-label">{persona.title}</span>
                  <span className="sdg-tpl-best" style={{ fontSize: 11 }}>
                    {persona.text}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      </div>

      {/* =============================== CLOSING ============================= */}
      <section className="container nv-cta-wrap" aria-labelledby="closing-title">
        <div className="nv-cta">
          <div>
            <span className="nv-pill nv-pill-invert">Home awaits</span>
            <h2 id="closing-title">See the marketplace for yourself.</h2>
            <p>Browse verified Ilorin stores, or open your own free storefront in minutes.</p>
          </div>
          <div className="nv-cta-actions">
            <Link href="/home" className="btn btn-white btn-lg">
              Enter the marketplace <ArrowRight size={16} />
            </Link>
            <Link href="/dashboard" className="btn btn-ghost-light btn-lg">
              Open a store
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
