import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { getStaffMembership } from '@/lib/staff';
import { LIMIT_LABELS, PLANS, isAtLimit, planFor, usagePercent } from '@/lib/plans';
import type { LimitKey } from '@/lib/plans';
import { RequestAccess } from './RequestAccess';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Plan & limits' };

export default async function PlanPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too

  // Staff never see plan/billing information; their nav omits this page and the
  // guard below stops a typed URL.
  const membership = await getStaffMembership(sb);
  const store = membership
    ? null
    : await getOwnStore<{ id: string; plan: string | null }>(sb, 'id, plan');

  if (!store) {
    return (
      <main>
        <h1>Plan &amp; limits</h1>
        <p className="muted">Create your store first.</p>
        <Link href="/dashboard/onboarding" className="btn btn-primary">
          Set up my store
        </Link>
      </main>
    );
  }

  const [listingsRes, staffRes, locationsRes] = await Promise.all([
    sb.from('listings').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
    sb.from('store_staff').select('*', { count: 'exact', head: true }).eq('store_id', store.id).eq('active', true),
    sb.from('store_locations').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
  ]);

  const plan = planFor(store.plan);
  const usage: Record<LimitKey, number> = {
    listings: listingsRes.count ?? 0,
    staff: staffRes.count ?? 0,
    locations: locationsRes.count ?? 0,
    // A store publishes one template at a time; the limit is how many it may
    // choose from, so the meter shows the active one.
    templates: 1,
  };

  return (
    <main>
      <h1>Plan &amp; limits</h1>
      <p className="muted">
        You are on <strong>{plan.name}</strong>. Limits are checked when you add a listing, invite
        staff or open a location.
      </p>

      <div className="alert" style={{ marginTop: 16 }}>
        <strong>Preview build.</strong> Plans and billing are mocked. Nothing on this page charges
        money, and requests are not sent anywhere.
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span className="badge badge-naija">Current plan</span>
            <h2 style={{ margin: '8px 0 2px' }}>{plan.name}</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>{plan.tagline}</p>
          </div>
          <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{plan.priceLabel}</span>
        </div>

        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          {(Object.keys(usage) as LimitKey[]).map((key) => {
            const limit = plan.limits[key];
            const used = usage[key];
            const pct = usagePercent(used, limit);
            const full = isAtLimit(used, limit);
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>{LIMIT_LABELS[key]}</span>
                  <span className="mono" style={{ color: full ? 'var(--danger, #b42318)' : undefined }}>
                    {used} / {limit == null ? '∞' : limit}
                  </span>
                </div>
                <div
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={`${LIMIT_LABELS[key]} used`}
                  style={{ height: 8, borderRadius: 999, background: 'var(--line, #e6e6e6)', overflow: 'hidden' }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${pct}%`,
                      borderRadius: 999,
                      background: full ? 'var(--danger, #b42318)' : 'var(--naija, #0b7a3b)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 14, marginTop: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {PLANS.map((p) => {
          const current = p.id === plan.id;
          return (
            <article key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>{p.name}</h2>
                <p className="mono" style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700 }}>{p.priceLabel}</p>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>{p.tagline}</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: 'grid', gap: 6 }}>
                {p.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                {current ? (
                  <span className="badge">You are here</span>
                ) : p.available ? (
                  <RequestAccess planName={p.name} />
                ) : (
                  <span className="badge">{p.priceLabel}</span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <p className="muted" style={{ marginTop: 20, fontSize: 13 }}>
        Need a limit raised before paid plans open? Ask the team through the same number that
        messaged you when your store was approved.
      </p>
    </main>
  );
}
