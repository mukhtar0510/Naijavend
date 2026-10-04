import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { getStaffMembership } from '@/lib/staff';
import { StaffGuard } from './StaffGuard';
import { DashNav } from './DashNav';
import { DashMobileNav } from './DashMobileNav';
import { ThemeToggleCompact } from '@/components/ThemeToggleCompact';
import { BackToMarket } from '@/components/BackToMarket';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/pos', label: 'POS' },
  { href: '/dashboard/listings', label: 'Listings' },
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/bookings', label: 'Bookings' },
  { href: '/dashboard/staff', label: 'Staff' },
  { href: '/dashboard/chat', label: 'Chat' },
  { href: '/dashboard/ai', label: 'AI Studio' },
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/ratings', label: 'Ratings' },
  { href: '/dashboard/settings', label: 'Settings' },
];

// Staff (tier-2 sellers' team members) sign in through the same page but get
// a reduced nav: their store's POS and orders only — never settings, payouts,
// listings or analytics.
const STAFF_NAV = [
  { href: '/dashboard/pos', label: 'POS' },
  { href: '/dashboard/orders', label: 'Orders' },
];

// Seller dashboard shell: fixed sidebar on desktop, sticky scrollable tab bar
// on mobile (see .dash-* styles in components.css / mobile.css).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin');

  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) {
    return (
      <div className="container" style={{ padding: '20px 20px 40px' }}>
        <div className="alert alert-error">Session problem — sign in again.</div>
      </div>
    );
  }

  // Staff membership first: staff don't own stores, so the owner lookup fails for them.
  const membership = await getStaffMembership(sb);
  if (membership) {
    return (
      <div className="dash-shell">
        <DashMobileNav
          items={STAFF_NAV}
          roleLabel={`Staff · ${membership.displayName}`}
          storeHref={`/s/${membership.slug}`}
        />
        <aside className="dash-sidebar">
          <div className="dash-sidebar-brand">
            <Link href="/" className="logo" aria-label="Naijavend home">
              Naija<span>vend</span>
            </Link>
            <span className="dash-sidebar-role">Staff · {membership.displayName}</span>
            <div className="dash-sidebar-tools"><ThemeToggleCompact /></div>
          </div>
          <DashNav items={STAFF_NAV} />
          <div className="dash-sidebar-foot">
            <Link href={`/s/${membership.slug}`} className="dash-sidebar-link dash-sidebar-view" target="_blank">
              View store ↗
            </Link>
            <form action="/dashboard/signout" method="post">
              <button className="dash-sidebar-link dash-sidebar-signout" type="submit">Sign out</button>
            </form>
          </div>
        </aside>
        <div className="dash-main">
          <StaffGuard allowed={['/dashboard/pos', '/dashboard/orders']} />
          {children}
        </div>
        <BackToMarket label="Marketplace" />
      </div>
    );
  }

  const store = await getOwnStore<{ slug: string; name: string }>(sb, 'slug, name');

  return (
    <div className="dash-shell">
      <DashMobileNav items={NAV} roleLabel="Seller studio" storeHref={store ? `/s/${store.slug}` : null} />
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <Link href="/" className="logo" aria-label="Naijavend home">
            Naija<span>vend</span>
          </Link>
          <span className="dash-sidebar-role">Seller studio</span>
          <div className="dash-sidebar-tools"><ThemeToggleCompact /></div>
        </div>
        <DashNav items={NAV} />
        <div className="dash-sidebar-foot">
          {store && (
            <Link href={`/s/${store.slug}`} className="dash-sidebar-link dash-sidebar-view" target="_blank">
              View my store ↗
            </Link>
          )}
          <form action="/dashboard/signout" method="post">
            <button className="dash-sidebar-link dash-sidebar-signout" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="dash-main">{children}</div>
      <BackToMarket label="Marketplace" />
    </div>
  );
}
