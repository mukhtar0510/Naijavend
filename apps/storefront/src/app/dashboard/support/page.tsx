// Support (23 Nov 2026): write to Kwaravend from the dashboard. Emirates Plus
// tickets are priority and answered first.
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { redirectStaffToPos } from '@/lib/staff';
import { BRAND } from '@idevtenancy/shared';
import { effectivePlan, hasFeature, planNameFor } from '@/lib/plans';
import { PLAN_COLUMNS, type PlanStore } from '@/lib/plan-gate';
import { SupportDesk, type TicketRow } from './SupportDesk';
import '../../../styles/dispatch.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Support' };

export default async function SupportPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin');
  await redirectStaffToPos(sb);
  const store = await getOwnStore<PlanStore>(sb, PLAN_COLUMNS);
  if (!store) {
    return (
      <main>
        <h1>Support</h1>
        <p className="muted">Create your store first.</p>
      </main>
    );
  }
  const priority = hasFeature(store, 'priority_support', true);
  const plan = effectivePlan(store);
  const { data, error } = await sb
    .from('support_tickets')
    .select('id, subject, message, priority, status, reply, replied_at, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(30);

  return (
    <main style={{ maxWidth: 820 }}>
      <h1>Support</h1>
      <p className="dash-sub">
        Ask the Kwaravend team anything about your store, orders, plan or payments. Replies appear here
        {priority ? '.' : `, usually within one working day.`}
      </p>
      {priority ? (
        <div className="alert alert-success" style={{ marginTop: 12 }}>
          You&apos;re on {plan.name}: your messages are priority and answered first.
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 13.5 }}>
          Priority support comes with {planNameFor('priority_support')}. You can also email {BRAND.supportEmail}.
        </p>
      )}
      {error ? (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          Support needs the latest database update. Email {BRAND.supportEmail} meanwhile.
        </div>
      ) : (
        <SupportDesk initial={(data ?? []) as TicketRow[]} />
      )}
    </main>
  );
}
