-- T10 event taxonomy + T07 seller waitlist. Non-destructive: new tables only.
-- Both are written by the server (service role) and read by the owner's admin
-- console through the server; no public access.

-- ---------------------------------------------------------------- events
-- One row per product event (BUILD.md T10). No personal data: an event name,
-- the store it belongs to and when. "Weekly active" = a store with at least
-- one of product_added / stock_updated / order_confirmed / delivery_assigned
-- / delivery_completed in the week.
create table if not exists public.platform_events (
  id bigint generated always as identity primary key,
  event text not null check (event in (
    'store_created', 'store_published', 'product_added', 'stock_updated',
    'cart_item_added', 'checkout_started', 'order_created', 'order_confirmed',
    'delivery_assigned', 'delivery_completed', 'booking_created',
    'store_link_shared', 'qr_downloaded', 'buyer_enquiry'
  )),
  store_id uuid references public.stores(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists platform_events_time_idx on public.platform_events (created_at desc);
create index if not exists platform_events_store_idx on public.platform_events (store_id, event, created_at desc);
alter table public.platform_events enable row level security; -- no policies: server only

-- --------------------------------------------------------------- waitlist
-- Sellers outside Ilorin (BUILD.md T07): they join a list, they don't get a
-- public listing. Phone is kept so the team can call them when their city opens.
create table if not exists public.seller_waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  city text not null check (char_length(city) between 2 and 60),
  category text not null default '' check (char_length(category) <= 40),
  created_at timestamptz not null default now(),
  unique (phone)
);
alter table public.seller_waitlist enable row level security; -- no policies: server only
