import Link from 'next/link';
import type { Metadata } from 'next';
import { NaijavendLogoMark, NaijavendWordmark } from '@/components/NaijavendLogo';
import { Stars } from '@/components/Stars';
import { OpenBadge } from '@/components/OpenBadge';
import { VerifiedTick } from '@/components/VerifiedTick';
import { StoreQrCode } from '@/components/StoreQrCode';
import { FeatureWheel } from '@/components/FeatureWheel';
import { ParallaxHeroMark } from '@/components/ParallaxHeroMark';
import { formatHours } from '@/lib/hours';

export const metadata: Metadata = {
  title: 'About Naijavend — how it works for sellers and customers',
  description:
    'Take the tour: real store websites, online orders, appointment booking, a free POS, staff accounts, multi-branch locations, honest reviews — see how Naijavend works for sellers and for customers.',
};

export const revalidate = 3600;

// Real component demos for the "components in action" strip. These are the
// actual widgets buyers see on store sites — rendered here with sample data.
const DEMO_HOURS = {
  mon: ['09:00', '18:00'],
  tue: ['09:00', '18:00'],
  wed: ['09:00', '18:00'],
  thu: ['09:00', '18:00'],
  fri: ['09:00', '20:00'],
  sat: ['10:00', '20:00'],
} as const;
const demoHoursRows = formatHours(DEMO_HOURS as unknown as Record<string, [string, string] | null>) ?? []; // formatHours returns null for empty hours — DEMO_HOURS is never empty

const SELLER_FEATURES = [
  {
    ico: '🌐',
    title: 'Your own store website',
    text: 'A real page at /s/your-name — your logo, colours, fonts and photos. Share it on WhatsApp, Instagram and Google.',
    demo: 'logo-strip',
  },
  {
    ico: '🛒',
    title: 'Online orders',
    text: 'Server-verified prices, stock tracking and discount codes. Buyers pay and your dashboard lights up.',
    demo: 'order',
  },
  {
    ico: '📅',
    title: 'Appointment booking',
    text: 'Services book real one-hour slots. The system blocks double-bookings — not you.',
    demo: 'booking',
  },
  {
    ico: '🖥️',
    title: 'POS terminal — free',
    text: 'Markets, pop-ups, counters: tap products, take cash/transfer/card. Stock and analytics stay in sync.',
    demo: 'pos',
  },
  {
    ico: '👥',
    title: 'Staff accounts — free',
    text: 'Cashiers and managers with their own sign-ins. Suspend or remove anyone in one tap.',
    demo: 'staff',
  },
  {
    ico: '📍',
    title: 'Multi-branch locations',
    text: 'Store 1, Store 2, Store 3… each with its own address, phone and hours — staff tagged per branch.',
    demo: 'locations',
  },
  {
    ico: '📊',
    title: 'Analytics',
    text: 'Visits, shares, chats, orders and conversion — know what sells and where buyers come from.',
    demo: 'analytics',
  },
  {
    ico: '🚚',
    title: 'Dropshipper mode',
    text: 'Sell supplier-shipped goods with an honest shipping-times card on your store site.',
    demo: null,
  },
] as const;

const CUSTOMER_FEATURES = [
  {
    ico: '🔎',
    title: 'Find real businesses',
    text: 'Every store is a real Nigerian business with a location, photos and public rankings.',
    demo: 'map',
  },
  {
    ico: '🟢',
    title: 'Know before you go',
    text: 'Live "Open now / Closed" badges, opening hours and delivery info on every store page.',
    demo: 'open-badge',
  },
  {
    ico: '💬',
    title: 'Chat before you buy',
    text: 'Message the seller in-app or jump to WhatsApp with a pre-filled question — no bots.',
    demo: 'chat',
  },
  {
    ico: '⭐',
    title: 'Honest reviews only',
    text: 'Only customers with a paid order or booking can review. No fake stars.',
    demo: 'stars',
  },
  {
    ico: '🏷️',
    title: 'Discount codes',
    text: 'Sellers run real promo codes — validated at checkout, never inflated prices.',
    demo: 'promo',
  },
  {
    ico: '👤',
    title: 'One account, everything',
    text: 'Track orders, bookings, saved stores and chats in one customer account. Google sign-in.',
    demo: 'account',
  },
] as const;

function DemoChip({ children }: { children: React.ReactNode }) {
  return <span className="nv-demo-chip">{children}</span>;
}

export default function AboutPage() {
  return (
    <main className="about-page">
      {/* ============ Hero ============ */}
      <div className="about-hero">
        <div className="hero-blob b1" />
        <div className="hero-blob b3" />
        <div className="container" style={{ position: 'relative', padding: '64px 20px 52px', textAlign: 'center' }}>
          <ParallaxHeroMark />
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', margin: '18px 0 10px' }}>
            The storefront platform for
            <br />
            <span style={{ color: 'var(--blue)' }}>Nigerian businesses</span>
          </h1>
          <p className="muted" style={{ fontSize: 18, maxWidth: 620, margin: '0 auto 26px' }}>
            Naijavend gives every seller a real website with orders, bookings, a free POS,
            staff accounts and multi-branch locations — and gives buyers a trusted place to
            find, chat with and review real businesses.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" className="btn btn-primary btn-lg">I&apos;m a seller — open a store</Link>
            <Link href="/discover" className="btn btn-black btn-lg">I&apos;m a buyer — browse stores</Link>
          </div>
        </div>
      </div>

      {/* ============ Components in action ============ */}
      <section className="container" style={{ padding: '48px 20px 8px' }}>
        <div className="about-sec-head">
          <h2>The pieces, in action</h2>
          <p className="muted">
            These are <strong>live components</strong> from real store pages — not screenshots.
          </p>
        </div>

        <div className="nv-demo-grid">
          {/* Store open / closed */}
          <div className="card nv-demo-card">
            <h3>Store opening &amp; closing</h3>
            <p className="muted" style={{ fontSize: 14 }}>
              Every store page computes Open/Closed live from the seller&apos;s weekly hours —
              buyers never turn up to a shut door wondering.
            </p>
            <div className="nv-demo-stage">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <OpenBadge hours={DEMO_HOURS as unknown as Record<string, [string, string] | null>} />
                <DemoChip>🟢 Open now</DemoChip>
                <DemoChip>🔴 Closed · opens 9:00</DemoChip>
              </div>
              <table className="hours-table nv-demo-hours">
                <tbody>
                  {demoHoursRows.map((row) => (
                    <tr key={row.day}>
                      <td>{row.day}</td>
                      <td style={{ textAlign: 'right' }}>{row.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ratings */}
          <div className="card nv-demo-card">
            <h3>Verified ratings</h3>
            <p className="muted" style={{ fontSize: 14 }}>
              Stars are only awarded after a real paid order or booking — the rankings stay honest.
            </p>
            <div className="nv-demo-stage">
              <Stars value={4.6} />
              <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 0' }}>
                4.6 · 38 reviews · verified purchases only
              </p>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
                <span className="badge badge-blue" style={{ fontSize: 13 }}>
                  Verified <VerifiedTick size={13} />
                </span>
              </div>
            </div>
          </div>

          {/* Ordering flow */}
          <div className="card nv-demo-card">
            <h3>Order &amp; booking flow</h3>
            <p className="muted" style={{ fontSize: 14 }}>
              Products are ordered, services are booked — prices re-checked on the server every time.
            </p>
            <div className="nv-demo-stage">
              <div className="nv-flow">
                <span className="nv-flow-step">Add to cart</span>
                <span className="nv-flow-arrow">→</span>
                <span className="nv-flow-step">Pay</span>
                <span className="nv-flow-arrow">→</span>
                <span className="nv-flow-step">Seller notified</span>
              </div>
              <div className="nv-flow" style={{ marginTop: 10 }}>
                <span className="nv-flow-step">Pick a slot</span>
                <span className="nv-flow-arrow">→</span>
                <span className="nv-flow-step">Booked ✓</span>
                <span className="nv-flow-arrow">→</span>
                <span className="nv-flow-step">Reminder</span>
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="card nv-demo-card">
            <h3>Chat &amp; WhatsApp</h3>
            <p className="muted" style={{ fontSize: 14 }}>
              Ask the seller anything in-app, or continue on WhatsApp with the question pre-filled.
            </p>
            <div className="nv-demo-stage nv-chat-demo">
              <div className="nv-bubble nv-bubble-buyer">Is the 6-inch cake available on Saturday?</div>
              <div className="nv-bubble nv-bubble-seller">Yes! Order before Friday 6pm and we&apos;ll deliver. 🎂</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ QR sharing — in action ============ */}
      <section className="container" style={{ padding: '40px 20px 8px' }}>
        <div className="about-sec-head">
          <span className="badge badge-black">New</span>
          <h2>Share any store or product with one scan</h2>
          <p className="muted">
            Every store and product page has its own QR code in the seller&apos;s brand colours —
            with the link printed right below. Print it, post it, or scan it: buyers land exactly where they should.
          </p>
        </div>
        <div className="nv-qr-demo">
          <div className="card nv-qr-demo-card">
            <h3>🏪 Store QR</h3>
            <p className="muted" style={{ fontSize: 13.5 }}>
              On every store page — opens the seller&apos;s full site: catalogue, hours, chat and reviews.
            </p>
            <StoreQrCode
              url="https://naijacart-roan.vercel.app/s/amaka-glow-studio"
              storeName="Amaka Glow Studio"
              accent="#BE1E6B"
              variant="card"
              title="Amaka Glow Studio"
            />
          </div>
          <div className="card nv-qr-demo-card">
            <h3>🛍️ Product QR</h3>
            <p className="muted" style={{ fontSize: 13.5 }}>
              On every product page — points straight at one item, ready to order. Perfect for price tags.
            </p>
            <StoreQrCode
              url="https://naijacart-roan.vercel.app/s/zaras-cake-studio"
              storeName="Zara's Cake Studio"
              accent="#1D4ED8"
              variant="card"
              title="Zara's Cake Studio"
            />
          </div>
          <div className="card nv-qr-demo-card">
            <h3>🖨️ How sellers use it</h3>
            <div className="nv-demo-stage" style={{ marginTop: 10 }}>
              <div className="nv-flow"><DemoChip>🪟 Shop window</DemoChip></div>
              <div className="nv-flow" style={{ marginTop: 8 }}><DemoChip>🏷️ Price tags</DemoChip></div>
              <div className="nv-flow" style={{ marginTop: 8 }}><DemoChip>📸 Instagram bio</DemoChip></div>
              <div className="nv-flow" style={{ marginTop: 8 }}><DemoChip>📄 Flyers &amp; receipts</DemoChip></div>
            </div>
            <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
              The QR carries the seller&apos;s accent colour and logo, with the plain link underneath for anyone who prefers to type.
            </p>
          </div>
        </div>
      </section>

      {/* ============ For sellers — 3D feature wheel ============ */}
      <section className="container" style={{ padding: '40px 20px' }}>
        <div className="about-sec-head">
          <span className="badge badge-black">For sellers</span>
          <h2>Run your whole business from one dashboard</h2>
          <p className="muted">Drag the wheel, or use the arrows. Everything is included free — POS, staff and branches too.</p>
        </div>
        <FeatureWheel items={SELLER_FEATURES.map((f) => ({ ico: f.ico, title: f.title, text: f.text }))} accent="var(--blue)" />
        <div className="nv-cta-row">
          <Link href="/dashboard" className="btn btn-primary btn-lg">Open your store — free</Link>
          <Link href="/faq" className="btn btn-outline btn-lg">Read the FAQ</Link>
        </div>
      </section>

      {/* ============ For customers — 3D feature wheel ============ */}
      <section className="container" style={{ padding: '8px 20px 56px' }}>
        <div className="about-sec-head">
          <span className="badge badge-blue">For customers</span>
          <h2>Shop local with total confidence</h2>
          <p className="muted">Real businesses, honest reviews, zero guesswork.</p>
        </div>
        <FeatureWheel items={CUSTOMER_FEATURES.map((f) => ({ ico: f.ico, title: f.title, text: f.text }))} accent="var(--nv-accent, #BE1E6B)" />
        <div className="nv-cta-row">
          <Link href="/discover" className="btn btn-black btn-lg">Discover stores near you</Link>
          <Link href="/account/signin" className="btn btn-outline btn-lg">Create a free account</Link>
        </div>
      </section>

      {/* ============ Closing CTA ============ */}
      <section className="container" style={{ padding: '0 20px 64px' }}>
        <div className="card card-elevated nv-closing" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <NaijavendLogoMark size={64} />
          </div>
          <h2 style={{ fontSize: 24, marginTop: 0 }}>Built in Nigeria, for Nigerian business.</h2>
          <p className="muted" style={{ fontSize: 16, maxWidth: 480, margin: '0 auto 20px' }}>
            Whether you sell cakes, braids, phones or lessons — your store site is minutes away,
            and your customers are already here.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" className="btn btn-primary btn-lg">Start selling</Link>
            <Link href="/" className="btn btn-outline btn-lg">Back to marketplace</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
