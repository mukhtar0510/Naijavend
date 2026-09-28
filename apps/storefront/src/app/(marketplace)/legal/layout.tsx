import Link from 'next/link';

const DOCS = [
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/terms', label: 'Terms of Service (User Agreement)' },
  { href: '/legal/cookies', label: 'Cookies Policy' },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container" style={{ padding: '36px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24, maxWidth: 780, margin: '0 auto' }}>
        <nav aria-label="Legal documents" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DOCS.map((d) => (
            <Link key={d.href} href={d.href} className="badge">{d.label}</Link>
          ))}
        </nav>
        <article className="legal-doc">{children}</article>
      </div>
    </main>
  );
}
