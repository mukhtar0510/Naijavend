-- iDevTenancy — core schema (intent: seller stores, catalog, orders, bookings, ratings)
-- Hardened per backend skill: uuid PKs, timestamptz everywhere, explicit ON DELETE,
-- indexed FKs, CHECK constraints, jsonb for queryable arrays.

create extension if not exists "pgcrypto";

-- ============ stores ============
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  business_type text not null default 'product' check (business_type in ('product','service','hybrid')),
  category text not null default 'general',
  description text not null default '',
  ai_generated_description boolean not null default false,
  logo_url text,
  address text not null default '',
  latitude numeric(9,6),
  longitude numeric(9,6),
  whatsapp_number text not null default '',
  plan text not null default 'free' check (plan in ('free','growth')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stores is
  'One row per seller store. Retention: retained while account active; deletion cascades to all store data (owner-initiated).';

create index idx_stores_owner on public.stores(owner_id);
create index idx_stores_category on public.stores(category);
create index idx_stores_location on public.stores(latitude, longitude);

-- ============ listings ============
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  type text not null check (type in ('product','service')),
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '',
  ai_generated_description boolean not null default false,
  price_kobo bigint not null check (price_kobo >= 0),
  is_bookable boolean not null default false,
  image_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_service_bookable check (type = 'product' or is_bookable = true)
);

create index idx_listings_store on public.listings(store_id);

-- ============ orders ============
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  -- Purpose: identity/contact for this order only. Retention: 24 months, then anonymized.
  customer_phone text not null check (customer_phone ~ '^\+?[0-9]{7,15}$'),
  total_kobo bigint not null check (total_kobo >= 0),
  status text not null default 'pending' check (status in ('pending','paid','fulfilled','cancelled')),
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_store on public.orders(store_id);
create index idx_orders_status on public.orders(store_id, status) where status in ('pending','paid');

-- ============ order_items ============
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 999),
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  created_at timestamptz not null default now()
);

create index idx_order_items_order on public.order_items(order_id);
create index idx_order_items_listing on public.order_items(listing_id);

-- ============ bookings ============
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (customer_phone ~ '^\+?[0-9]{7,15}$'),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  deposit_paid_kobo bigint not null default 0 check (deposit_paid_kobo >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_slot_order check (slot_end > slot_start)
);

create index idx_bookings_listing on public.bookings(listing_id);
create index idx_bookings_slot on public.bookings(listing_id, slot_start);

-- Prevent double-booking: overlapping non-cancelled bookings for the same listing are rejected.
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    listing_id with =,
    tstzrange(slot_start, slot_end) with &&
  ) where (status <> 'cancelled');

-- ============ store_ratings ============
create table public.store_ratings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  -- Purpose: anonymous identity check so one customer can't spam ratings. Retention: 24 months.
  customer_phone text not null,
  order_id uuid references public.orders(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  stars integer not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  -- One rating per customer phone per store
  constraint ratings_unique_per_customer unique (store_id, customer_phone)
);

create index idx_ratings_store on public.store_ratings(store_id);

-- ============ ai_usage_log ============
create table public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  feature text not null check (feature in ('store_setup','listing_description')),
  tokens_used integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_ai_usage_store on public.ai_usage_log(store_id);

-- ============ whatsapp_settings ============
create table public.whatsapp_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  business_number text not null default '',
  greeting_message text not null default '',
  catalog_enabled boolean not null default false
);

-- ============ updated_at trigger ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_stores_updated before update on public.stores
  for each row execute function public.set_updated_at();
create trigger trg_listings_updated before update on public.listings
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();
create trigger trg_bookings_updated before update on public.bookings
  for each row execute function public.set_updated_at();
