import Link from 'next/link';

export const metadata = {
  title: 'Legal',
  description: 'Naijavend legal documents: privacy policy, terms of service and cookies policy.',
};

export default function LegalIndex() {
  return (
    <div className="card" style={{ padding: 28 }}>
      <h1>Legal documents</h1>
      <p className="muted">
        The agreements that govern your use of Naijavend — whether you&apos;re shopping or selling.
      </p>
      <ul style={{ lineHeight: 2 }}>
        <li><Link href="/legal/privacy">Privacy Policy</Link> — what we collect, why, and your rights.</li>
        <li><Link href="/legal/terms">Terms of Service (User Agreement)</Link> — the rules for buyers and sellers.</li>
        <li><Link href="/legal/cookies">Cookies Policy</Link> — the cookies and local storage we use and why.</li>
      </ul>
      <p className="muted" style={{ fontSize: 14 }}>
        Questions about anything here? Contact us through the in-app chat or at naijavend2026@gmail.com.
      </p>
    </div>
  );
}
