-- Paid plans (owner, 22 Nov 2026: "make the plans activatable and payable").
-- Sellers buy a plan by bank transfer to Kwaravend; the owner confirms the
-- money in /admin, which activates the plan until plan_expires_at. Paystack
-- can later create the same plan_payments rows through the payment-provider
-- seam. Non-destructive: widens one check and adds columns/tables.

-- All four plans (the original check allowed only free/growth).
alter table public.stores drop constraint if exists stores_plan_check;
alter table public.stores add constraint stores_plan_check check (plan in ('free', 'growth', 'plus', 'pro'));
alter table public.stores add column if not exists plan_expires_at timestamptz;

-- One row per plan purchase.
create table if not exists public.plan_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan text not null check (plan in ('growth', 'plus', 'pro')),
  months smallint not null default 1 check (months between 1 and 12),
  amount_kobo integer not null check (amount_kobo > 0), -- computed by the server from the plan price
  reference text not null unique check (char_length(reference) between 6 and 40),
  status text not null default 'pending' check (status in ('pending', 'awaiting_confirmation', 'paid', 'rejected', 'cancelled')),
  method text not null default 'bank_transfer' check (method in ('bank_transfer', 'paystack')),
  proof_url text,
  note text not null default '' check (char_length(note) <= 200),
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists plan_payments_store_idx on public.plan_payments (store_id, created_at desc);
create index if not exists plan_payments_status_idx on public.plan_payments (status, created_at desc);
alter table public.plan_payments enable row level security;
-- Owners can read their own purchases; every write goes through the server.
drop policy if exists plan_payments_owner_read on public.plan_payments;
create policy plan_payments_owner_read on public.plan_payments
  for select using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Platform settings (e.g. Kwaravend's own bank account for plan payments).
-- Server-only: no policies. The owner edits them in /admin.
create table if not exists public.platform_settings (
  key text primary key check (char_length(key) <= 60),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.platform_settings enable row level security;

-- Sellers can update their own store row (RLS), so guard the plan columns:
-- only the server (service role, after a confirmed payment) may change them,
-- and a seller-created store always starts on Free.
create or replace function public.guard_store_plan()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then
    return new; -- service role (owner confirming a payment, expiry jobs)
  end if;
  if tg_op = 'INSERT' then
    new.plan := 'free';
    new.plan_expires_at := null;
    return new;
  end if;
  if new.plan is distinct from old.plan or new.plan_expires_at is distinct from old.plan_expires_at then
    raise exception 'Plans change only after a confirmed payment';
  end if;
  return new;
end $$;
revoke execute on function public.guard_store_plan() from public, anon, authenticated;
drop trigger if exists trg_guard_store_plan on public.stores;
create trigger trg_guard_store_plan before insert or update on public.stores
  for each row execute function public.guard_store_plan();
