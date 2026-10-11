-- Digital products: sellers can list code, ebooks and other downloadable files.
-- Buyers pay like any product; once the order is PAID they get a one-time
-- download token that this same migration stores in digital_deliveries.

-- 1. Extend the listing type constraint to admit 'digital'.
alter table public.listings
  drop constraint listings_type_check;

alter table public.listings
  add constraint listings_type_check
    check (type in ('product','service','digital'));

-- Digital listings may also be bookable=false like products; keep the existing
-- service/bookable rule intact by leaving that constraint untouched.

-- 2. Where the file lives: a Supabase Storage path inside the store-media
-- bucket, private via prefix. Only downloaded through the delivery route.
alter table public.listings
  add column if not exists digital_file_path text;

-- File metadata the buyer sees (size + name before buying).
alter table public.listings
  add column if not exists digital_file_name text;
alter table public.listings
  add column if not exists digital_file_size bigint check (digital_file_size is null or digital_file_size between 1 and 52428800); -- 50 MB

-- 3. Delivery ledger: one row per (order, listing) that has been paid, holding
-- a one-time token. The route burns the token on first use.
create table if not exists public.digital_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  buyer_email text not null,
  download_token text not null unique,
  token_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, listing_id)
);

create index if not exists idx_digital_deliveries_token on public.digital_deliveries(download_token);
create index if not exists idx_digital_deliveries_order on public.digital_deliveries(order_id);

alter table public.digital_deliveries enable row level security;

-- Nobody reads deliveries directly through the anon client; the download route
-- uses the service role. These policies exist so the service role is the ONLY
-- path (deny-by-default with explicit policies is the safest shape here).
create policy "no public anonym read on digital deliveries"
  on public.digital_deliveries for select
  to anon
  using (false);

-- Trigger: when an order goes to 'paid', mint delivery rows for every digital
-- item in that order (idempotent: one row per order+listing).
create or replace function public.mint_digital_deliveries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact text;
begin
  if new.status <> 'paid' or old.status = 'paid' then
    return new; -- only the pending -> paid transition mints
  end if;

  -- We don't collect email; the buyer's phone doubles as the delivery contact.
  v_contact := new.customer_phone;

  insert into public.digital_deliveries (order_id, listing_id, store_id, buyer_email, download_token)
  select
    oi.order_id,
    oi.listing_id,
    new.store_id,
    v_contact,
    encode(gen_random_bytes(32), 'hex')  -- 64-hex-char one-time token
  from public.order_items oi
  join public.listings l on l.id = oi.listing_id
  where oi.order_id = new.id
    and l.type = 'digital'
    and l.digital_file_path is not null
  on conflict (order_id, listing_id) do nothing;

  return new;
end $$;

drop trigger if exists trg_mint_digital_deliveries on public.orders;
create trigger trg_mint_digital_deliveries
  after update on public.orders
  for each row
  execute function public.mint_digital_deliveries();

-- That trigger writes after-update on public.orders; it must exist AFTER the
-- orders table itself, which this migration guarantee since orders was created
-- in 20260911000001.
