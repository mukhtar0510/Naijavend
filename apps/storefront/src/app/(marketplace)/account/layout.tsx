import Link from 'next/link';
import { getCustomerUser, getCustomerClient } from '@/lib/auth';
import { AccountNav } from './AccountNav';

const NAV = [
  { href: '/account', label: 'Orders' },
  { href: '/account/bookings', label: 'Bookings' },
  { href: '/account/chats', label: 'Chats' },
  { href: '/account/alerts', label: 'Alerts' },
  { href: '/account/ai', label: 'Ask AI' },
  { href: '/account/profile', label: 'Profile & settings' },
];

// Not a hard gate: /account renders a friendly sign-in prompt when logged out.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomerUser();

  if (!customer) {
    return <>{children}</>;
  }

  // Avatar + first name for the header. Read here rather than in a nested async
  // component: a `Promise<Element>` is not a JSX element type under the locked
  // React 18 typings, and the Vercel build rejects it.
  const sb = await getCustomerClient();
  const { data: profile } = sb
    ? await sb.from('customers').select('full_name, avatar_url').eq('id', customer.id).maybeSingle()
    : { data: null };
  const fullName = (profile?.full_name as string) || '';
  const avatarUrl = (profile?.avatar_url as string | null) || null;
  const firstName = fullName.split(/\s+/).filter(Boolean)[0] || customer.email.split('@')[0];
  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '\u{1F642}';

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <div className="account-tabs" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <AccountNav items={NAV} />
        <span style={{ flex: 1 }} />
        <Link href="/account/profile" className="acct-who" title="Edit your profile">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- customer-supplied remote URL
            <img className="acct-who-avatar" src={avatarUrl} alt="" />
          ) : (
            <span className="acct-who-avatar acct-who-initials" aria-hidden>{initials}</span>
          )}
          <span className="acct-who-name">Hi, {firstName}</span>
        </Link>
        <form action="/api/account/signout" method="post">
          <button className="btn btn-outline btn-sm" type="submit">Sign out</button>
        </form>
      </div>
      {children}
    </div>
  );
}
