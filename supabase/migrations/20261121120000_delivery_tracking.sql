-- T09 delivery tracking (Phase B, status-based) + seller bank details for
-- checkout. Non-destructive: new tables only.
--
--   store_bank_accounts  where buyers transfer money (owner-only; buyers see it
--                        only through the server, for their own order)
--   riders               a seller's own riders (no accounts)
--   deliveries           one per delivered order: status, rider, tokens
--   delivery_secrets     the buyer's handover code; NO policies, so only the
--                        service role (server) can read it — a seller can't
--                        skip the code by reading the table
--   delivery_events      the buyer-visible timeline
--
-- Live rider GPS (Phase C) is NOT here; no location of riders is stored.

-- ---------------------------------------------------------------- bank
create table if not exists public.store_bank_accounts (
  store_id uuid primary key references public.stores(id) on delete cascade,
  bank_name text not null check (char_length(bank_name) between 2 and 60),
  account_name text not null check (char_length(account_name) between 2 and 80),
  account_number text not null check (account_number ~ '^[0-9]{10}$'), -- NUBAN
  updated_at timestamptz not null default now()
);
alter table public.store_bank_accounts enable row level security;
drop policy if exists store_bank_owner_all on public.store_bank_accounts;
create policy store_bank_owner_all on public.store_bank_accounts
  for all using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- --------------------------------------------------------------- riders
create table if not exists public.riders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  phone text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  vehicle text not null default 'bike' check (vehicle in ('bike', 'tricycle', 'car', 'van', 'foot')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists riders_store_idx on public.riders (store_id, active);
alter table public.riders enable row level security;
drop policy if exists riders_owner_all on public.riders;
create policy riders_owner_all on public.riders
  for all using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- ----------------------------------------------------------- deliveries
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  rider_id uuid references public.riders(id) on delete set null,
  status text not null default 'awaiting_dispatch' check (status in (
    'awaiting_dispatch', 'assigned', 'picked_up', 'in_transit', 'arrived',
    'delivered', 'failed_attempt', 'returned'
  )),
  -- Unguessable links: buyer tracking page and the rider's page.
  tracking_token text not null unique check (char_length(tracking_token) >= 20),
  rider_token text unique check (rider_token is null or char_length(rider_token) >= 20),
  eta_window text not null default '' check (char_length(eta_window) <= 60),
  failure_reason text not null default '' check (char_length(failure_reason) <= 160),
  proof text not null default '' check (proof in ('', 'otp', 'seller_confirmed')),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deliveries_store_status_idx on public.deliveries (store_id, status, updated_at desc);
alter table public.deliveries enable row level security;
-- Read-only for the owner: every change goes through the server, which checks
-- ownership and the status rules (and the handover code for "delivered").
drop policy if exists deliveries_owner_read on public.deliveries;
create policy deliveries_owner_read on public.deliveries
  for select using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Handover code: service role only (no policies on purpose).
create table if not exists public.delivery_secrets (
  delivery_id uuid primary key references public.deliveries(id) on delete cascade,
  otp text not null check (otp ~ '^[0-9]{4}$'),
  attempts smallint not null default 0
);
alter table public.delivery_secrets enable row level security;

-- --------------------------------------------------------------- events
create table if not exists public.delivery_events (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  status text not null,
  note text not null default '' check (char_length(note) <= 200),
  actor text not null default 'seller' check (actor in ('seller', 'rider', 'system')),
  created_at timestamptz not null default now()
);
create index if not exists delivery_events_delivery_idx on public.delivery_events (delivery_id, created_at);
alter table public.delivery_events enable row level security;
drop policy if exists delivery_events_owner_read on public.delivery_events;
create policy delivery_events_owner_read on public.delivery_events
  for select using (exists (
    select 1 from public.deliveries d join public.stores s on s.id = d.store_id
    where d.id = delivery_id and s.owner_id = auth.uid()
  ));
-- Writes go through the server (service role) so every change is validated.
