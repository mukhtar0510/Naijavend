// Owner growth dashboard (BUILD.md T10): stores created and published,
// weekly active stores, setup completion, stores with an order, 30-day
// retention, orders and naira value, delivery performance, per-area
// breakdown and stores by plan. Built from real rows only.
import { requireAdminActor } from '@/lib/admin';
import { apiError, apiOk, internalError } from '@/lib/api';
import { ACTIVE_EVENTS } from '@/lib/events';
import { inIlorin, nearestArea } from '@/lib/ilorin';

const DAY = 86_400_000;

export async function GET() {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc } = actor;
  try {
    const now = Date.now();
    const since7 = new Date(now - 7 * DAY).toISOString();
    const since30 = new Date(now - 30 * DAY).toISOString();
    const since60 = new Date(now - 60 * DAY).toISOString();

    const [storesRes, listingsRes, ordersRes, eventsRes, deliveriesRes] = await Promise.all([
      svc.from('stores').select('id, plan, plan_expires_at, created_at, latitude, longitude, business_hours, whatsapp_number, is_example').eq('is_example', false),
      svc.from('listings').select('store_id'),
      svc.from('orders').select('store_id, total_kobo, status, payment_status, created_at').gte('created_at', since60),
      svc.from('platform_events').select('event, store_id, created_at').gte('created_at', since60).limit(20000),
      svc.from('deliveries').select('status, failure_reason, created_at, delivered_at').gte('created_at', since30),
    ]);

    const stores = (storesRes.data ?? []) as Array<{ id: string; created_at: string; latitude: number | null; longitude: number | null; business_hours: unknown; whatsapp_number: string | null }>;
    const storeIds = new Set(stores.map((s) => s.id));
    const listingCount = new Map<string, number>();
    for (const l of (listingsRes.data ?? []) as Array<{ store_id: string }>) listingCount.set(l.store_id, (listingCount.get(l.store_id) ?? 0) + 1);

    // Setup = the onboarding checklist: 3 products, hours, WhatsApp, a pin.
    const setupDone = stores.filter(
      (s) => (listingCount.get(s.id) ?? 0) >= 3 && s.business_hours && (s.whatsapp_number ?? '').trim() && s.latitude != null,
    ).length;
    const published = stores.filter((s) => (listingCount.get(s.id) ?? 0) >= 3).length;

    const orders = ((ordersRes.data ?? []) as Array<{ store_id: string; total_kobo: number; status: string; payment_status: string | null; created_at: string }>).filter((o) => storeIds.has(o.store_id));
    const orders30 = orders.filter((o) => o.created_at >= since30 && o.status !== 'cancelled');
    const paid30 = orders30.filter((o) => o.payment_status === 'paid' || o.status === 'paid' || o.status === 'fulfilled');
    const storesWithOrder = new Set(orders.map((o) => o.store_id)).size;

    const events = (eventsRes.error ? [] : (eventsRes.data ?? [])) as Array<{ event: string; store_id: string | null; created_at: string }>;
    const activeIn = (from: string, to: string) =>
      new Set(events.filter((e) => e.store_id && storeIds.has(e.store_id) && ACTIVE_EVENTS.includes(e.event as never) && e.created_at >= from && e.created_at < to).map((e) => e.store_id)).size;
    const weeklyActive = activeIn(since7, new Date(now + DAY).toISOString());
    // 30-day retention: stores created 30–60 days ago that were active in the last 30 days.
    const cohort = stores.filter((s) => s.created_at >= since60 && s.created_at < since30).map((s) => s.id);
    const activeLast30 = new Set(events.filter((e) => e.store_id && ACTIVE_EVENTS.includes(e.event as never) && e.created_at >= since30).map((e) => e.store_id));
    const retained = cohort.filter((id) => activeLast30.has(id)).length;

    const deliveries = (deliveriesRes.error ? [] : (deliveriesRes.data ?? [])) as Array<{ status: string; failure_reason: string; created_at: string; delivered_at: string | null }>;
    const delivered = deliveries.filter((d) => d.status === 'delivered');
    const firstTry = delivered.filter((d) => !d.failure_reason).length;

    const byArea = new Map<string, number>();
    for (const s of stores) {
      const label = s.latitude != null && s.longitude != null && inIlorin(Number(s.latitude), Number(s.longitude)) ? nearestArea(Number(s.latitude), Number(s.longitude)).label : 'No pin yet';
      byArea.set(label, (byArea.get(label) ?? 0) + 1);
    }
    const byPlan = new Map<string, number>();
    for (const st of stores as Array<{ plan?: string | null; plan_expires_at?: string | null }>) {
      const lapsed = st.plan && st.plan !== 'free' && st.plan_expires_at && Date.parse(st.plan_expires_at) < now;
      const p = !st.plan || lapsed ? 'free' : st.plan;
      byPlan.set(p, (byPlan.get(p) ?? 0) + 1);
    }

    const eventCounts: Record<string, number> = {};
    for (const e of events) if (e.created_at >= since30) eventCounts[e.event] = (eventCounts[e.event] ?? 0) + 1;

    return apiOk({
      eventsReady: !eventsRes.error,
      deliveriesReady: !deliveriesRes.error,
      stores: {
        total: stores.length,
        new7: stores.filter((s) => s.created_at >= since7).length,
        published,
        setupDone,
        setupRate: stores.length ? Math.round((setupDone / stores.length) * 100) : 0,
        weeklyActive,
        withOrder: storesWithOrder,
        retention30: cohort.length ? Math.round((retained / cohort.length) * 100) : null,
        cohortSize: cohort.length,
      },
      orders30: { count: orders30.length, valueKobo: orders30.reduce((a, o) => a + Number(o.total_kobo ?? 0), 0), paidCount: paid30.length, paidKobo: paid30.reduce((a, o) => a + Number(o.total_kobo ?? 0), 0) },
      deliveries30: { total: deliveries.length, delivered: delivered.length, firstTryRate: delivered.length ? Math.round((firstTry / delivered.length) * 100) : null },
      areas: [...byArea.entries()].sort((a, b) => b[1] - a[1]).map(([area, count]) => ({ area, count })),
      plans: [...byPlan.entries()].sort((a, b) => b[1] - a[1]).map(([plan, count]) => ({ plan, count })),
      events30: eventCounts,
    });
  } catch (err) {
    return internalError('admin-growth', err);
  }
}
