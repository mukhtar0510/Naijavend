import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description: 'How Naijavend works — buying, selling, the blue tick, the map, and your privacy, answered.',
};

const FAQS: Array<{ group: string; icon: string; items: Array<{ q: string; a: React.ReactNode }> }> = [
  {
    group: 'Buying',
    icon: '🛍️',
    items: [
      {
        q: 'How do I order a product or book a service?',
        a: (
          <>
            Open any store, pick an item, and use <strong>Order</strong> (products) or <strong>Book</strong> (services).
            You&apos;ll get a summary you can send to the seller on WhatsApp or in-app chat to confirm payment and
            delivery or pickup.
          </>
        ),
      },
      {
        q: 'How do I know a store is legit?',
        a: (
          <>
            Every store is a real business with a real address on the map. Check the star rating and reviews, look for
            the <strong>blue tick</strong> (30+ reviews averaging 4 stars), and use the map view to see exactly where
            they are.
          </>
        ),
      },
      {
        q: 'What are discount codes?',
        a: 'Sellers can create promo codes. If a store has one, enter it at checkout — the discount is applied to the order total before you send it.',
      },
    ],
  },
  {
    group: 'Selling',
    icon: '🏪',
    items: [
      {
        q: 'How much does a store cost?',
        a: (
          <>
            Free. You get your own store website (<em>naijavend.ng/s/your-name</em>), catalogue, bookings, chat and
            analytics at no cost to start. Create an account from the{' '}
            <Link href="/dashboard/signin">seller sign-in</Link> page.
          </>
        ),
      },
      {
        q: 'How do I get the blue verification tick?',
        a: (
          <>
            Collect <strong>30+ genuine reviews averaging 4 stars or more</strong>, then apply from your dashboard.
            We check the store&apos;s own review stats — never buy or trade reviews; verified badges can be revoked if
            review integrity is compromised.
          </>
        ),
      },
      {
        q: 'What are dropshipper stores?',
        a: (
          <>
            Dropshippers ship items directly from a supplier to your customer. They carry the{' '}
            <strong>🚚 Dropshipper</strong> badge and publish their typical delivery window on their store site.
          </>
        ),
      },
    ],
  },
  {
    group: 'Reviews & rankings',
    icon: '⭐',
    items: [
      {
        q: 'Who can review a store?',
        a: (
          <>
            Only customers who actually ordered or booked through the store&apos;s site — every store has a review
            link tied to real transactions. That&apos;s what keeps the rankings honest.
          </>
        ),
      },
      {
        q: 'How do rankings work?',
        a: (
          <>
            Stores are ranked by review score and volume with recency weighting — see the{' '}
            <Link href="/rankings">Rankings</Link> page. Games and fake reviews are removed and can cost an account.
          </>
        ),
      },
    ],
  },
  {
    group: 'Map & location',
    icon: '🗺️',
    items: [
      {
        q: 'How does the map and "distance from you" work?',
        a: (
          <>
            Share your location once (or pick a base area like Lekki or Surulere) and every store is placed by real
            distance and direction, with walking and driving estimates. Your location is{' '}
            <strong>stored only in your browser</strong> — it is never sent to our servers.
          </>
        ),
      },
    ],
  },
  {
    group: 'Account & privacy',
    icon: '🔒',
    items: [
      {
        q: 'How do I sign in?',
        a: (
          <>
            <strong>Continue with Google</strong> — one tap, no password to remember.
            Your seller sign-in uses the same Google account.
            no password needed. Sellers and shoppers use separate logins, and you can be both.
          </>
        ),
      },
      {
        q: 'What are saved stores and referrals?',
        a: (
          <>
            Tap the ♡ on any store to save it to your account page. Your invite link is on the same page — friends who
            sign up through it within 30 days are credited to you.
          </>
        ),
      },
      {
        q: 'What data do you collect?',
        a: (
          <>
            Only what&apos;s needed to run the service — see the <Link href="/legal/privacy">Privacy Policy</Link> and{' '}
            <Link href="/legal/cookies">Cookies Policy</Link> for the plain-English version.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <main>
      <div className="page-intro">
        <div className="container">
          <h1>Frequently asked questions</h1>
          <p>Everything about buying, selling and trusting stores on Naijavend — in plain English.</p>
        </div>
      </div>
      <div className="container-narrow" style={{ padding: '24px 20px 48px' }}>
        {FAQS.map((group) => (
          <section key={group.group} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden>{group.icon}</span> {group.group}
            </h2>
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {group.items.map((item) => (
                <details key={item.q} className="card faq-item">
                  <summary>{item.q}</summary>
                  <div className="faq-a">{item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px', fontSize: 15 }}>Still stuck? Chat any seller in-app, or browse the legal pages.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/discover" className="btn btn-primary">Discover stores</Link>
            <Link href="/legal" className="btn btn-outline">Legal &amp; policies</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
