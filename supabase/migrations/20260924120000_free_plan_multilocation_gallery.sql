-- Free plan unification + multi-location + store gallery.
--
-- 1. POS & staff are now for everyone: stores.plan stays for historical
--    record but no code path requires 'growth' any more.
-- 2. Multi-location: a store can register several branches (Store 1, Store 2…),
--    each with its own name, address, pin, phone and hours. The store's own
--    main address remains the primary branch/hero address.
-- 3. Staff location tags: a staff member can be tagged to one or more branch
--    ids; null/empty = works at every branch. POS and locations pages filter
--    by these tags.
-- 4. Store gallery: 1–5 uploaded pictures of the shop, shown on the store site.

create table if not exists public.store_locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  label text not null default 'Branch' check (char_length(label) between 1 and 60),
  position int not null default 1,
  address text not null default '' check (char_length(address) <= 300),
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone text not null default '' check (char_length(phone) <= 16),
  business_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists store_locations_store_idx on public.store_locations (store_id, position);

alter table public.store_locations enable row level security;

drop policy if exists "locations owner all" on public.store_locations;
create policy "locations owner all" on public.store_locations
  for all to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Public site needs to read the branches to show them on the store page.
drop policy if exists "locations public read" on public.store_locations;
create policy "locations public read" on public.store_locations
  for select using (true);

grant select on public.store_locations to anon, authenticated;
grant insert, update, delete on public.store_locations to authenticated;

-- Owner-managed staff location tags (array of store_locations ids).
alter table public.store_staff add column if not exists location_ids uuid[] not null default '{}';

-- Store photo gallery (1–5 urls, uploaded to store-media by the seller).
alter table public.store_themes add column if not exists gallery_urls jsonb not null default '[]'::jsonb;

-- Optional friendly caption for each branch (e.g. "Lekki flagship").
-- Kept inside the same table to avoid another join on the public site.
alter table public.store_locations add column if not exists note text not null default '' check (char_length(note) <= 160);
