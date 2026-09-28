export const metadata = {
  title: 'Privacy Policy',
  description: 'How Naijavend collects, uses and protects your personal data.',
};

const SECTIONS: Array<{ h: string; p: string[] }> = [
  {
    h: '1. Who we are',
    p: [
      'Naijavend ("we", "us") is a marketplace platform that lets Nigerian sellers create their own online store sites and lets customers discover, order from, book and chat with those sellers. This policy explains what personal data we collect and how we use it, whether you are a customer or a seller.',
    ],
  },
  {
    h: '2. Data we collect',
    p: [
      'Account data: your email address and password (stored only as a secure hash), and — for customers — your name and phone number if you provide them.',
      'Store data (sellers): store name, description, category, address or map pin, WhatsApp business number, social media handles, and the products/services and images you upload.',
      'Transaction data: orders and bookings you place through store sites, including items, quantities and status. Payment is arranged between you and the seller (e.g. on WhatsApp or bank transfer) — we never see or store your card details or bank credentials.',
      'Reviews: the star rating and optional comment you leave for a store, linked to the phone number used for the order or booking.',
      'Messages: chats you send to a seller through the in-app chat, so both sides keep a history.',
      'Usage analytics: anonymous events such as store visits, listing views, shares and link copies. These contain no names, emails or identifiers — see the Cookies Policy for details.',
      'Location data: the map view and distance features run entirely in your browser. When you share your location (or pick a base area), it is stored only on your device and used to compute distances and directions in the app — your precise location is never sent to Naijavend servers.',
    ],
  },
  {
    h: '3. How we use your data',
    p: [
      'To operate your account and keep it secure.',
      'For customers: to show your orders and bookings in one place, and to let you rate stores you actually transacted with.',
      'For sellers: to run your store site, dashboard, order/booking management and analytics.',
      'To compute public rankings from verified reviews (we never publish your phone number or email).',
      'To detect abuse, prevent fraud and enforce our Terms of Service.',
    ],
  },
  {
    h: '4. What we share',
    p: [
      'With sellers: the name, phone number and items of orders/bookings placed on their store, and the messages you send them.',
      'Publicly: your store content (if you are a seller), review stars and comments, and aggregated ranking positions. We do not sell your personal data, and we do not share it with advertisers.',
      'Our infrastructure providers (hosting, database, email delivery) process data strictly on our instructions to run the service.',
    ],
  },
  {
    h: '5. Storage & security',
    p: [
      'Data is stored on managed infrastructure with encryption in transit and at rest. Sessions use signed, http-only cookies. Passwords are hashed with a modern password-hashing algorithm and can never be read by us.',
    ],
  },
  {
    h: '6. Your rights',
    p: [
      'You may request a copy of your data, correct it, or delete your account at any time. Sellers can edit or remove their store content from the dashboard. Customers can contact a store directly to resolve an order, and can ask us to delete reviews they posted. To exercise any right, contact naijavend2026@gmail.com.',
    ],
  },
  {
    h: '7. Retention',
    p: [
      'We keep account and transaction data for as long as your account is active, plus a reasonable period for record-keeping and dispute resolution. Anonymous analytics events may be retained in aggregate form.',
    ],
  },
  {
    h: '8. Store visits & verification',
    p: [
      'Store visits: opening a store page records an anonymous view event (page path, referrer and time — no account, name or contact details). Sellers see aggregate visit counts in their dashboard and cannot identify individual visitors.',
      'Verification: sellers whose stores have earned 30+ reviews averaging 4 stars or more can apply for the blue "verified" tick. We check eligibility against the store\u2019s own review statistics only.',
    ],
  },
  {
    h: '9. Changes',
    p: [
      'If we change this policy materially, we will announce it on the platform before it takes effect. The "last updated" date below always reflects the current version.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="card" style={{ padding: 28 }}>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: 20 September 2026</p>
      {SECTIONS.map((s) => (
        <section key={s.h} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 18 }}>{s.h}</h2>
          {s.p.map((para, i) => (
            <p key={i} style={{ fontSize: 15 }}>{para}</p>
          ))}
        </section>
      ))}
    </div>
  );
}
