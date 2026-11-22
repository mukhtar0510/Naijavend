-- Plan features (owner, 23 Nov 2026): three plans (Free, Business, Emirates
-- Plus) and the features they promise that were not built yet:
--   * Kwaravend rider add-on (bought with a plan) and rider requests
--   * priority support tickets
--   * custom domains for a store
-- Non-destructive: Business Pro ('pro') stays valid in the check for old rows
-- (none exist), but it is no longer sold.

-- Kwaravend rider add-on, bought with a plan for the same months.
alter table public.plan_payments add column if not exists rider_addon boolean not null default false;
alter table public.stores add column if not exists rider_expires_at timestamptz;

-- Extend the plan guard: rider_expires_at is also server-only.
create or replace function public.guard_store_plan()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then
    return new; -- service role (owner confirming a payment, expiry jobs)
  end if;
  if tg_op = 'INSERT' then
    new.plan := 'free';
    new.plan_expires_at := null;
    new.rider_expires_at := null;
    return new;
  end if;
  if new.plan is distinct from old.plan
     or new.plan_expires_at is distinct from old.plan_expires_at
     or new.rider_expires_at is distinct from old.rider_expires_at then
    raise exception 'Plans change only after a confirmed payment';
  end if;
  return new;
end $$;
revoke execute on function public.guard_store_plan() from public, anon, authenticated;

-- A seller asks Kwaravend for a rider for one delivery.
create table if not exists public.rider_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  speed text not null default 'standard' check (speed in ('standard', 'express', 'same_day')),
  pickup text not null default '' check (char_length(pickup) <= 300),
  dropoff text not null default '' check (char_length(dropoff) <= 300),
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'requested' check (status in ('requested', 'assigned', 'picked_up', 'delivered', 'cancelled')),
  rider_name text check (char_length(rider_name) <= 80),
  rider_phone text check (char_length(rider_phone) <= 20),
  admin_note text not null default '' check (char_length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rider_requests_store_idx on public.rider_requests (store_id, created_at desc);
create index if not exists rider_requests_status_idx on public.rider_requests (status, created_at desc);
alter table public.rider_requests enable row level security;
drop policy if exists rider_requests_owner_read on public.rider_requests;
create policy rider_requests_owner_read on public.rider_requests
  for select using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Support tickets; Emirates Plus tickets are marked priority.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 5 and 2000),
  priority boolean not null default false,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  reply text not null default '' check (char_length(reply) <= 2000),
  replied_by text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_store_idx on public.support_tickets (store_id, created_at desc);
create index if not exists support_tickets_queue_idx on public.support_tickets (status, priority desc, created_at);
alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_owner_read on public.support_tickets;
create policy support_tickets_owner_read on public.support_tickets
  for select using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Custom domains. Active domains are public (the edge middleware maps a host
-- to a store page); pending ones are visible only to the owner.
create table if not exists public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  domain text not null unique check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' and char_length(domain) <= 253),
  status text not null default 'pending' check (status in ('pending', 'active', 'failed')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);
alter table public.store_domains enable row level security;
drop policy if exists store_domains_public_active on public.store_domains;
create policy store_domains_public_active on public.store_domains
  for select using (status = 'active');
drop policy if exists store_domains_owner_read on public.store_domains;
create policy store_domains_owner_read on public.store_domains
  for select using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
