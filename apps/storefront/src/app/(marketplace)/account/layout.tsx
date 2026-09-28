import Link from 'next/link';
import { getCustomerUser } from '@/lib/auth';
import { AccountNav } from './AccountNav';
import { ThemeToggleCompact } from '@/components/ThemeToggleCompact';

const NAV = [
  { href: '/account', label: 'Orders' },
  { href: '/account/bookings', label: 'Bookings' },
  { href: '/account/chats', label: 'Chats' },
  { href: '/account/profile', label: 'Profile' },
];

// Not a hard gate: /account renders a friendly sign-in prompt when logged out.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomerUser();

  if (!customer) {
    return <>{children}</>;
  }

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <div className="account-tabs" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <AccountNav items={NAV} />
        <span style={{ flex: 1 }} />
        <ThemeToggleCompact />
        <form action="/api/account/signout" method="post">
          <button className="btn btn-outline btn-sm" type="submit">Sign out</button>
        </form>
      </div>
      {children}
    </div>
  );
}
