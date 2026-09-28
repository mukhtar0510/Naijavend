import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { getStaffMembership } from '@/lib/staff';
import { PosTerminal, type PosListing } from './PosTerminal';
import type { Store } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

export default async function PosPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too

  // Staff cashiers land here too — resolve them before the owner lookup.
  const membership = sb ? await getStaffMembership(sb) : null;
  const store = membership
    ? { id: membership.storeId, name: membership.name, slug: membership.slug, plan: membership.plan }
    : await getOwnStore<Pick<Store, 'id' | 'name' | 'slug' | 'plan'>>(sb, 'id, name, slug, plan');

  if (!store) {
    return (
      <main>
        <h1>POS</h1>
        <p className="muted">Create your store first.</p>
        <Link className="btn btn-primary" href="/dashboard/onboarding">Set up my store</Link>
      </main>
    );
  }

  const isGrowth = true; // POS is free for everyone now — gate removed.

  const { data: listings } = await sb.from('listings').select('id, title, price_kobo, stock, type, image_urls').eq('store_id', store.id);
  const products: PosListing[] = (listings ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    title: l.title as string,
    price_kobo: l.price_kobo as number,
    stock: (l.stock as number | null) ?? null,
    type: l.type as string,
    image_url: Array.isArray(l.image_urls) ? (l.image_urls[0] as string) ?? null : null,
  }));

  return (
    <main>
      <h1>POS terminal</h1>
      <p className="dash-sub">
        {membership
          ? `Charging as ${membership.displayName} — sales record under ${store.name}.`
          : 'Tap products to build a ticket — charges record instantly as paid orders.'}
      </p>
      <PosTerminal listings={products} slug={store.slug} isGrowth={isGrowth} staffName={membership?.displayName ?? null} />
    </main>
  );
}
