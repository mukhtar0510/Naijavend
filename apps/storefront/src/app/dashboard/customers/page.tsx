import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { getStaffMembership } from '@/lib/staff';
import { CustomersClient } from './CustomersClient';
import type { CustomerRow, CustomerOrder } from './CustomersClient';
import { orderRef } from '@idevtenancy/shared';
import '../../../styles/crm.css';
import { FEATURES } from '@/lib/flags';
import { hasFeature, planNameFor } from '@/lib/plans';
import { LockedFeature } from '@/components/LockedFeature';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Customers' };

interface OrderRow {
  id: string;
  payment_status?: string | null;
  order_items?: Array<{ quantity: number; listings: { title: string } | Array<{ title: string }> | null }> | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_kobo: number | null;
  status: string;
  created_at: string;
}

/**
 * T12 — seller CRM. Customers are derived from the store's own orders (one
 * row per phone number) with order count, lifetime value, last order and
 * their recent orders for the history drawer. Notes live in
 * store_customer_notes (owner-only).
 */
export default async function CustomersPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too

  const membership = await getStaffMembership(sb);
  const store = membership
    ? ((await sb.from('stores').select('*').eq('id', membership.storeId).maybeSingle()).data as { id: string; plan: string | null } | null) ?? { id: membership.storeId, plan: null }
    : await getOwnStore<{ id: string; plan: string | null; plan_expires_at?: string | null }>(sb, '*');

  if (!store) {
    return (
      <main>
        <h1>Customers</h1>
        <p className="muted">Create your store first.</p>
        <Link href="/dashboard/onboarding" className="btn btn-primary">
          Set up my store
        </Link>
      </main>
    );
  }

  if (!hasFeature(store, 'crm', FEATURES.planGating)) return <LockedFeature title="Customers" planName={planNameFor('crm')} />;

  const { data } = await sb
    .from('orders')
    .select('id, customer_name, customer_phone, total_kobo, status, payment_status, created_at, order_items(quantity, listings(title))')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(500);

  const byPhone = new Map<string, CustomerRow>();
  const history: Record<string, CustomerOrder[]> = {};

  for (const o of (data ?? []) as OrderRow[]) {
    const phone = (o.customer_phone ?? '').trim();
    const name = (o.customer_name ?? '').trim();
    // A phone number is the only stable identifier we have; skip rows without one.
    if (!phone) continue;
    const items = (o.order_items ?? [])
      .map((i) => {
        const l = Array.isArray(i.listings) ? i.listings[0] : i.listings;
        return `${i.quantity} × ${l?.title ?? 'Item'}`;
      })
      .join(', ');
    (history[phone] ??= []).length < 12 &&
      history[phone]!.push({
        ref: orderRef(o.id),
        at: o.created_at,
        totalKobo: Number(o.total_kobo ?? 0),
        status: o.status,
        paid: o.payment_status === 'paid' || o.status === 'paid' || o.status === 'fulfilled',
        items,
      });
    const existing = byPhone.get(phone);
    const counted = o.status !== 'cancelled';
    if (existing) {
      existing.orders += counted ? 1 : 0;
      existing.spentKobo += counted ? Number(o.total_kobo ?? 0) : 0;
      if (!existing.name && name) existing.name = name;
      if (o.created_at > existing.lastOrderAt) existing.lastOrderAt = o.created_at;
    } else {
      byPhone.set(phone, {
        phone,
        name: name || 'Unnamed buyer',
        orders: counted ? 1 : 0,
        spentKobo: counted ? Number(o.total_kobo ?? 0) : 0,
        firstOrderAt: o.created_at,
        lastOrderAt: o.created_at,
      });
    }
  }

  const customers = Array.from(byPhone.values()).sort((a, b) =>
    b.lastOrderAt.localeCompare(a.lastOrderAt)
  );

  // Notes live in store_customer_notes. A missing table (migration not applied
  // yet) must not break the customer list — fall back to an empty set.
  const { data: noteRows, error: notesError } = await sb
    .from('store_customer_notes')
    .select('phone, note')
    .eq('store_id', store.id);
  const notes: Record<string, string> = {};
  for (const row of (noteRows ?? []) as Array<{ phone: string; note: string }>) {
    notes[row.phone] = row.note;
  }

  return (
    <main>
      <h1>Customers</h1>
      <p className="muted">
        Everyone who has ordered from your store, built from your own orders. Nothing is shared
        between stores.
      </p>

      {notesError && (
        <div className="alert" style={{ marginTop: 16 }}>
          <strong>Notes need the database update.</strong> The customer list is live from your
          orders. Saving a note falls back to this browser until the
          <span className="mono"> store_customer_notes </span> migration is applied.
        </div>
      )}

      <CustomersClient storeId={store.id} customers={customers} initialNotes={notes} history={history} notesInStore={!notesError} />
    </main>
  );
}
