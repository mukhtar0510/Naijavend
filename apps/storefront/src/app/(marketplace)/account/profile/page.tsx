import Link from 'next/link';
import { getCustomerUser, getCustomerClient } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const customer = await getCustomerUser();

  if (!customer) {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <h1>Profile</h1>
        <p className="muted">Sign in to manage your customer profile.</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/account/signin" className="btn btn-primary">Sign in</Link>
          <Link href="/discover" className="btn btn-outline">Browse stores</Link>
        </div>
      </main>
    );
  }

  const sb = await getCustomerClient();
  const { data: profile } = sb
    ? await sb.from('customers').select('full_name, phone, created_at').eq('id', customer.id).maybeSingle()
    : { data: null };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at as string).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
    : null;

  return (
    <main className="container-narrow" style={{ padding: '24px 20px' }}>
      <h1>Profile</h1>
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="field">
          <label>Email</label>
          <p style={{ margin: 0 }}>{customer.email}</p>
        </div>
        <div className="field">
          <label>Full name</label>
          <p style={{ margin: 0 }}>{(profile?.full_name as string) || 'Not set yet'}</p>
        </div>
        <div className="field">
          <label>Phone</label>
          <p style={{ margin: 0 }}>{(profile?.phone as string) || 'Not set yet'}</p>
          <p className="hint">Used to match your bookings and reviews to your account.</p>
        </div>
        {memberSince && (
          <p className="muted" style={{ fontSize: 14 }}>Member since {memberSince}.</p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Link href="/account" className="btn btn-outline">My orders</Link>
        <Link href="/account/bookings" className="btn btn-outline">My bookings</Link>
      </div>
    </main>
  );
}
