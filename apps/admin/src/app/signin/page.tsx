import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

const POINTS = [
  'Verify stores and hand out blue ticks',
  'Triage the trust & safety flag queue',
  'Watch GMV, MRR and the onboarding funnel',
  'Ban, restore or erase accounts with a full audit trail',
];

// Email + password sign-in for the standalone admin. Any visitor lands here;
// only emails on ADMIN_EMAILS with a valid password get through.
export default async function AdminSignInPage() {
  const admin = await currentAdmin();
  if (admin) redirect('/');

  return (
    <main className="signin-admin">
      <aside className="signin-admin-aside">
        <span className="signin-admin-logo">
          Naija<span>vend</span>
        </span>

        <div>
          <h2>One console for the whole marketplace.</h2>
          <p>
            The working surface for the people who keep Naijavend honest, fast and trustworthy.
          </p>
        </div>

        <ul className="signin-admin-points">
          {POINTS.map((p) => (
            <li key={p}>
              <span aria-hidden>✓</span>
              {p}
            </li>
          ))}
        </ul>
      </aside>

      <section className="signin-admin-panel">
        <div className="signin-admin-card">
          <span className="signin-admin-logo">
            Naija<span>vend</span>
          </span>
          <h1>Control</h1>
          <p className="muted" style={{ margin: '0 0 4px', fontSize: 13 }}>
            Platform administration — authorised admins only.
          </p>
          <LoginForm />
          <p className="signin-admin-note">
            Access is limited to the emails on the ADMIN_EMAILS allow-list. Every action is recorded
            in the audit log.
          </p>
        </div>
      </section>
    </main>
  );
}
