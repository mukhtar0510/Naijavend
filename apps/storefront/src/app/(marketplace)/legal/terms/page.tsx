export const metadata = {
  title: 'Terms of Service',
  description: 'The user agreement governing the use of Naijavend by buyers and sellers.',
};

const SECTIONS: Array<{ h: string; p: string[] }> = [
  {
    h: '1. The agreement',
    p: [
      'These Terms of Service ("Terms") form the agreement between you and Naijavend when you use the platform — browsing stores, ordering products, booking services, chatting, rating, or creating a seller account and store site. By using Naijavend you accept these Terms.',
    ],
  },
  {
    h: '2. Accounts',
    p: [
      'You must provide a valid email address and a strong password, and you are responsible for keeping your credentials safe and for all activity under your account. You must be at least 18 years old to create a seller account. One person or business per seller account.',
    ],
  },
  {
    h: '3. Sellers and store sites',
    p: [
      'Sellers are responsible for their store content: the accuracy of listings, prices, photos they upload (you must own or have the right to use them), the address and contact details they publish, and the fulfilment of orders and bookings.',
      'Sellers must not list illegal, counterfeit, dangerous or misleading items, and must not use the platform to harass anyone. We may remove content or suspend stores that breach these rules.',
      'Naijavend provides the storefront and tooling; the contract of sale or service is between the seller and the buyer. Sellers are responsible for any taxes, permits or registrations their business requires.',
    ],
  },
  {
    h: '4. Buyers',
    p: [
      'Buyers should review a listing carefully and use the chat or WhatsApp to confirm availability before ordering. When you place an order or booking, it is an offer to the seller, which the seller confirms. Payment and delivery/fulfilment are arranged between buyer and seller — Naijavend does not hold funds.',
      'If something goes wrong with an order, first contact the seller; they are the party to the sale. Naijavend may step in to mediate obvious disputes and will remove sellers who consistently fail their customers.',
    ],
  },
  {
    h: '5. Reviews and rankings',
    p: [
      'Reviews must be genuine and based on a real transaction with the store. Fake, paid-for or retaliatory reviews are prohibited; we remove them and may suspend accounts. Rankings are computed from review data using our published weighting — do not attempt to game them.',
    ],
  },
  {
    h: '6. Acceptable use',
    p: [
      'Do not scrape, spam, reverse-engineer, overload or interfere with the platform; do not impersonate others; do not upload malicious code or unlawful content. We may throttle or block abusive traffic.',
    ],
  },
  {
    h: '7. Availability and changes',
    p: [
      'We aim for a reliable service but provide Naijavend "as is" and "as available". We may add, change or remove features. We are not liable for indirect or consequential loss arising from downtime or errors to the maximum extent permitted by law.',
    ],
  },
  {
    h: '8. Ending the agreement',
    p: [
      'You can stop using Naijavend and delete your account at any time. We may suspend or terminate accounts that breach these Terms. Sections that by their nature should survive termination (e.g. liability, content licences granted) do so.',
    ],
  },
  {
    h: '9. Verification and badges',
    p: [
      'The blue tick marks stores that met our verification rule when they applied: 30+ genuine reviews averaging 4.0 stars or more. Verification signals review-based trust, not an endorsement of any individual product or claim.',
      'Sellers must not buy, trade or incentivise reviews to reach the threshold. We may decline, pause or revoke verification if review integrity is compromised, the rule is no longer met, or the store breaches these Terms.',
    ],
  },
  {
    h: '10. Governing law',
    p: [
      'These Terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Nigeria have exclusive jurisdiction over any dispute arising from them.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="card" style={{ padding: 28 }}>
      <h1>Terms of Service</h1>
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
