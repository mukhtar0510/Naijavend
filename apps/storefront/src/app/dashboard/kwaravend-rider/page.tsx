// Kwaravend rider (plan add-on, 23 Nov 2026): Business and Emirates Plus
// sellers with the rider add-on ask Kwaravend for a rider per delivery.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { redirectStaffToPos } from '@/lib/staff';
import { LockedFeature } from '@/components/LockedFeature';
import { FEATURES } from '@/lib/flags';
import { KWARAVEND_RIDERS_COMING_SOON, effectivePlan, hasFeature, planNameFor, riderActive, riderLabel, riderSpeeds } from '@/lib/plans';
import { PLAN_COLUMNS, type PlanStore } from '@/lib/plan-gate';
import { RiderRequests, type RiderRequestRow } from './RiderRequests';
import '../../../styles/dispatch.css';
import '../../../styles/store-designer.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kwaravend rider' };

export default async function KwaravendRiderPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin');
  await redirectStaffToPos(sb);
  const store = await getOwnStore<PlanStore & { address?: string | null }>(sb, `${PLAN_COLUMNS}, address`);
  if (!store) {
    return (
      <main>
        <h1>Kwaravend rider</h1>
        <p className="muted">Create your store first.</p>
      </main>
    );
  }
  if (KWARAVEND_RIDERS_COMING_SOON) {
    return (
      <main style={{ maxWidth: 720 }}>
        <h1>
          Kwaravend rider <span className="badge">Coming soon</span>
        </h1>
        <p className="dash-sub">
          Soon you&apos;ll be able to ask Kwaravend for a rider who picks up from your shop and delivers across Ilorin. It
          isn&apos;t running yet, and nothing is charged for it.
        </p>
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 17, marginTop: 0 }}>Deliver with your own riders today, free</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Add the riders you already work with, then assign them to orders from Dispatch. Buyers get a tracking link.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href="/dashboard/riders">
              Add your riders
            </Link>
            <Link className="btn btn-outline" href="/dashboard/dispatch">
              Open Dispatch
            </Link>
          </div>
        </div>
      </main>
    );
  }
  if (!hasFeature(store, 'kwaravend_rider', FEATURES.planGating)) {
    return (
      <LockedFeature title="Kwaravend rider" planName={planNameFor('kwaravend_rider')}>
        A Kwaravend rider picks up from your shop and delivers across Ilorin. It&apos;s an add-on to the {planNameFor('kwaravend_rider')} and Emirates Plus plans.
      </LockedFeature>
    );
  }

  const plan = effectivePlan(store);
  const active = riderActive(store);
  const [reqRes, ordersRes] = await Promise.all([
    sb
      .from('rider_requests')
      .select('id, speed, pickup, dropoff, note, status, rider_name, rider_phone, admin_note, created_at')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('orders')
      .select('id, customer_name, delivery_area, created_at')
      .eq('store_id', store.id)
      .in('delivery_method', ['rider', 'courier', 'zone'])
      .not('status', 'in', '(cancelled,fulfilled)')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  return (
    <main style={{ maxWidth: 820 }}>
      <h1>Kwaravend rider</h1>
      <p className="dash-sub">
        Ask Kwaravend for a rider and we&apos;ll send one to your shop. You see the rider&apos;s name and phone here as soon as one
        is assigned. Your plan includes the {riderLabel(plan.limits.rider ?? null)}.
      </p>
      {!active && (
        <div className="alert" style={{ marginTop: 12 }}>
          The rider add-on isn&apos;t on yet. <Link href="/dashboard/plan">Add it in Plan</Link> (tick &ldquo;Add Kwaravend rider&rdquo; when you buy or
          renew), then request riders here.
        </div>
      )}
      {reqRes.error ? (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          Rider requests need the latest database update.
        </div>
      ) : (
        <RiderRequests
          active={active}
          speeds={riderSpeeds(plan)}
          storeAddress={store.address ?? ''}
          orders={(ordersRes.data ?? []).map((o) => ({
            id: o.id as string,
            label: `${(o.id as string).slice(0, 8).toUpperCase()} · ${o.customer_name ?? 'Buyer'}${o.delivery_area ? ` · ${o.delivery_area}` : ''}`,
          }))}
          initial={(reqRes.data ?? []) as RiderRequestRow[]}
        />
      )}
    </main>
  );
}
