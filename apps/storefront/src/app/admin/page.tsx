import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin, adminEmails } from '@/lib/admin';
import { getCustomerUser } from '@/lib/auth';
import { AdminConsole } from './AdminConsole';
import { BackToMarket } from '@/components/BackToMarket';

export const metadata = { title: 'Control · Naijavend' };

// Superadmin console. Gated by the ADMIN_EMAILS env list — any signed-in user
// (customer or seller session) whose email is on the list gets access; everyone
// else is bounced to the sign-in page with ?next=/admin.
export default async function AdminPage() {
  const admin = await isAdmin();
  if (!admin) {
    const email = (await getCustomerUser())?.email ?? null;
    if (!email) redirect('/account/signin?next=/admin');
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1>Not authorised</h1>
        <p className="muted">
          {email} is not an administrator. Ask the platform owner to add your email to ADMIN_EMAILS.
        </p>
        <Link href="/" className="btn btn-outline">
          Back to marketplace
        </Link>
      </div>
    );
  }

  const email = (await getCustomerUser())?.email ?? adminEmails()[0] ?? 'admin';
  return (
    <>
      <AdminConsole adminEmail={email} />
      <BackToMarket label="Marketplace" />
    </>
  );
}
