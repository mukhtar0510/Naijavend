-- iDevTenancy — Row Level Security (intent: tenant isolation + public read paths)
-- Every table gets RLS with explicit per-operation policies.
-- Test matrix (backend skill #18/#57): each policy has an allow case and a deny case
-- documented inline. Test as anon, authenticated seller (other store), and owner.

alter table public.stores enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.bookings enable row level security;
alter table public.store_ratings enable row level security;
alter table public.ai_usage_log enable row level security;
alter table public.whatsapp_settings enable row level security;

-- ============ stores ============
-- Owner manages own store. Deny case: seller B updating seller A's store -> 0 rows.
create policy stores_owner_all on public.stores
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
-- Public can read any store (storefront is public by design; slug is the key).
create policy stores_public_read on public.stores
  for select using (true);

-- ============ listings ============
create policy listings_owner_all on public.listings
  for all using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );
create policy listings_public_read on public.listings
  for select using (true);

-- ============ orders ============
-- Owner reads/writes own orders. Public can INSERT (checkout) but NOT read others' orders.
-- Deny case: anon selecting another store's orders -> 0 rows.
create policy orders_owner_all on public.orders
  for all using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );
create policy orders_public_insert on public.orders
  for insert with check (status = 'pending' and total_kobo >= 0);

-- ============ order_items ============
create policy order_items_owner_all on public.order_items
  for all using (
    exists (
      select 1 from public.orders o
      join public.stores s on s.id = o.store_id
      where o.id = order_id and s.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.orders o
      join public.stores s on s.id = o.store_id
      where o.id = order_id and s.owner_id = auth.uid()
    )
  );
create policy order_items_public_insert on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_id and o.status = 'pending')
  );

-- ============ bookings ============
create policy bookings_owner_all on public.bookings
  for all using (
    exists (
      select 1 from public.listings l
      join public.stores s on s.id = l.store_id
      where l.id = listing_id and s.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.listings l
      join public.stores s on s.id = l.store_id
      where l.id = listing_id and s.owner_id = auth.uid()
    )
  );
create policy bookings_public_insert on public.bookings
  for insert with check (status = 'pending');

-- ============ store_ratings ============
-- Anon can INSERT a rating (validated server-side that order/booking belongs to the store).
-- Anon can SELECT ratings (public reviews). Nobody anonymous can UPDATE/DELETE.
create policy ratings_public_insert on public.store_ratings
  for insert with check (stars between 1 and 5);
create policy ratings_public_read on public.store_ratings
  for select using (true);
-- Owner sees own store's ratings incl. phone identity (needed for abuse handling).
create policy ratings_owner_read on public.store_ratings
  for select using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );

-- ============ ai_usage_log ============
-- Written only by service role (edge/server). Owner can read own usage.
create policy ai_usage_owner_read on public.ai_usage_log
  for select using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );

-- ============ whatsapp_settings ============
create policy whatsapp_owner_all on public.whatsapp_settings
  for all using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );
create policy whatsapp_public_read on public.whatsapp_settings
  for select using (true);
