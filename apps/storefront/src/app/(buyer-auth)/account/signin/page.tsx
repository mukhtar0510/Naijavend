import Link from 'next/link';
import { BadgeCheck, MapPin, MessageSquare, Star } from 'lucide-react';
import { BackToMarket } from '@/components/BackToMarket';
import { KwaravendLogoMark } from '@/components/KwaravendLogo';
import { SignInPanel, type AuthMode } from './SignInPanel';

export const metadata = { title: 'Sign in' };

const HIGHLIGHTS = [
  { icon: Star, title: '4.8 average', text: 'from customers who actually ordered' },
  { icon: MapPin, title: 'Real addresses', text: 'every storefront is a real business' },
  { icon: MessageSquare, title: 'Talk first', text: 'chat in-app or on WhatsApp before paying' },
];

/** Only allow local, absolute paths — never `//evil.com`, `\\evil.com` or a scheme. */
function safeNext(raw: string | undefined): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) return raw;
  return '/account';
}

// Google-only auth: one button covers sign-in and sign-up. Supabase creates
// the auth user on first sign-in and a DB trigger seeds the customer profile.
// Deep links like /account/signin?next=/admin are honoured so the user returns
// to the page that asked them to sign in.
export default async function CustomerSignInPage({
  searchParams,
}: {
  searchParams: { next?: string; mode?: string };
}) {
  const next = safeNext(searchParams.next);
  const initialMode: AuthMode = searchParams.mode === 'create' ? 'create' : 'signin';

  return (
    <main className="nv-auth">
      <section className="nv-auth-aside">
        <div className="nv-auth-aside-orb a" aria-hidden />
        <div className="nv-auth-aside-orb b" aria-hidden />

        <Link href="/" className="nv-auth-brand">
          <KwaravendLogoMark size={30} />
          <span>
            Kwara<em>vend</em>
          </span>
        </Link>

        <div className="nv-auth-aside-copy">
          <span className="nv-auth-eyebrow">
            <BadgeCheck size={13} aria-hidden /> Verified marketplace
          </span>
          <h2>Shop local with total confidence.</h2>
          <p>
            Every store on Kwaravend is a Nigerian business with its own website, a real location
            and reviews that can only come from real orders.
          </p>
        </div>

        <ul className="nv-auth-highlights">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="nv-auth-highlight-ico" aria-hidden>
                <Icon size={16} />
              </span>
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </li>
          ))}
        </ul>

        <p className="nv-auth-aside-foot">Made in Nigeria  · Free for buyers, always</p>
      </section>

      <section className="nv-auth-panel">
        <div className="nv-auth-panel-inner">
          <SignInPanel next={next} initialMode={initialMode} />
        </div>
      </section>

      <BackToMarket label="Kwaravend" />
    </main>
  );
}
