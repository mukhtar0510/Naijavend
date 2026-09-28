import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { StaffManager, type StaffRow } from './StaffManager';
import { StaffToggle, StaffRemove } from './StaffActions';
import type { Store } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too
  const store = await getOwnStore<Pick<Store, 'id' | 'name' | 'slug' | 'plan'>>(sb, 'id, name, slug, plan');

  if (!store) {
    return (
      <main>
        <h1>Staff</h1>
        <p className="muted">Create your store first.</p>
      </main>
    );
  }

  // Staff accounts are free for everyone now — the growth-plan paywall is gone.

  const [{ data: rows }, { data: locRows }] = await Promise.all([
    sb.from('store_staff').select('id, display_name, role, active, location_ids').eq('store_id', store.id).order('created_at'),
    sb.from('store_locations').select('id, label').eq('store_id', store.id).order('position'),
  ]);
  const staff: StaffRow[] = (rows ?? []) as StaffRow[];
  const locations = (locRows ?? []) as Array<{ id: string; label: string }>;
  const labelFor = (id: string) => locations.find((l) => l.id === id)?.label ?? 'Branch';

  return (
    <main>
      <h1>Staff</h1>
      <p className="dash-sub">{staff.length === 0 ? 'No one yet — add your first team member below.' : `${staff.length} team member${staff.length === 1 ? '' : 's'} under ${store.name}.`}</p>

      <section className="dash-section" aria-labelledby="sec-staff-add" style={{ marginTop: 12 }}>
        <div className="dash-section-head">
          <h2 id="sec-staff-add">Add a team member</h2>
        </div>
        <div className="dash-panel">
          <StaffManager slug={store.slug} locations={locations} />
        </div>
      </section>

      <section className="dash-section" aria-labelledby="sec-staff-list">
        <div className="dash-section-head">
          <h2 id="sec-staff-list">Your team</h2>
        </div>
        <div className="dash-panel">
          {staff.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Nobody yet. Invite your first cashier above.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {staff.map((m) => (
                <div key={m.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 16px' }}>
                  <div>
                    <strong>{m.display_name}</strong>{' '}
                    <span className="badge badge-blue">{m.role}</span>{' '}
                    {!m.active && <span className="badge badge-danger">suspended</span>}
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(() => {
                        const tags = Array.isArray((m as StaffRow & { location_ids?: string[] }).location_ids)
                          ? (m as StaffRow & { location_ids?: string[] }).location_ids!
                          : [];
                        if (tags.length === 0) return <span className="badge">All branches</span>;
                        return tags.map((id) => (
                          <span key={id} className="badge badge-blue">📍 {labelFor(id)}</span>
                        ));
                      })()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <StaffToggle staffId={m.id} slug={store.slug} active={m.active} />
                    <StaffRemove staffId={m.id} slug={store.slug} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
