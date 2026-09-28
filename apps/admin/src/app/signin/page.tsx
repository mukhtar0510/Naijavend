import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

// Email + password sign-in for the standalone admin. Any visitor lands here;
// only emails on ADMIN_EMAILS with a valid password get through.
export default async function AdminSignInPage() {
  const admin = await currentAdmin();
  if (admin) redirect('/');

  return (
    <main className="signin-admin">
      <div className="card signin-admin-card">
        <span className="signin-admin-logo">Naija<span>vend</span></span>
        <h1>Control</h1>
        <p className="muted" style={{ margin: '0 0 18px', fontSize: 14 }}>
          Platform administration — authorised admins only.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
