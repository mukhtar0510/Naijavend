import Link from 'next/link';
import { getCustomerUser, getCustomerClient } from '@/lib/auth';
import { ProfileEditor } from './ProfileEditor';

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
    ? await sb
        .from('customers')
        .select('full_name, phone, avatar_url, created_at')
        .eq('id', customer.id)
        .maybeSingle()
    : { data: null };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at as string).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
    : null;

  return (
    <main className="container-narrow" style={{ padding: '24px 20px' }}>
      <h1>Profile</h1>
      <ProfileEditor
        email={customer.email}
        initialName={(profile?.full_name as string) || ''}
        initialPhone={(profile?.phone as string) || ''}
        initialAvatarUrl={(profile?.avatar_url as string | null) || null}
        memberSince={memberSince}
      />

      <div className="prof-links">
        <Link href="/account" className="prof-link-card">
          <span className="prof-link-ico" aria-hidden>🧾</span>
          <span>
            <strong>My orders</strong>
            <span className="muted">Track deliveries and downloads</span>
          </span>
          <span className="prof-link-arrow" aria-hidden>→</span>
        </Link>
        <Link href="/account/bookings" className="prof-link-card">
          <span className="prof-link-ico" aria-hidden>📅</span>
          <span>
            <strong>My bookings</strong>
            <span className="muted">Appointments with sellers</span>
          </span>
          <span className="prof-link-arrow" aria-hidden>→</span>
        </Link>
        <Link href="/account/chats" className="prof-link-card">
          <span className="prof-link-ico" aria-hidden>💬</span>
          <span>
            <strong>My chats</strong>
            <span className="muted">Messages with stores</span>
          </span>
          <span className="prof-link-arrow" aria-hidden>→</span>
        </Link>
      </div>
    </main>
  );
}
