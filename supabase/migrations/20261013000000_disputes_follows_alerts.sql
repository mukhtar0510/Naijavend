-- Buyer safety + follow/alerts core (October 2026).
--
-- 1. orders gains a real 'refunded' terminal state (dispute refunds).
-- 2. disputes — buyer reports a problem on an order; seller resolves, refunds
--    or rejects with a note. One OPEN dispute per order (partial unique index).
-- 3. store_follows — server-side "follow store" (localStorage hearts stay as
--    favourites; this is the feed source for alerts).
-- 4. alerts — per-customer inbox rows (new product, price drop, order/booking
--    status, dispute update, chat). Filled by triggers + app writes.

-- ============ 0. delivery options (per-store fees, shown at checkout) ============
alter table public.stores add column if not exists delivery_options jsonb;
comment on column public.stores.delivery_options is
  'Checkout delivery methods, e.g. {"pickup":{"enabled":true,"fee_kobo":0},"rider":{"enabled":true,"fee_kobo":150000},"courier":{"enabled":false,"fee_kobo":500000}}; null = no structured options (legacy free-form delivery_info only).';

alter table public.orders add column if not exists delivery_method text not null default '';
alter table public.orders add column if not exists delivery_fee_kobo integer not null default 0 check (delivery_fee_kobo >= 0);

-- ============ 1. orders: allow the refunded terminal state ============
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded'));

-- Sellers may move paid/fulfilled -> refunded (dispute resolution), never to 'paid'.
create or replace function public.guard_order_status_transition()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null then
    return new; -- service role (payment webhook / mock-pay / dispute refund path)
  end if;
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'pending' and new.status = 'cancelled' then
    return new;
  end if;
  if old.status = 'paid' and new.status in ('fulfilled', 'cancelled', 'refunded') then
    return new;
  end if;
  if old.status = 'fulfilled' and new.status in ('refunded', 'cancelled') then
    return new;
  end if;
  raise exception 'Order status transition % -> % not allowed for sellers', old.status, new.status;
end $$;

-- ============ 2. disputes ============
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  -- Null customer_id = anonymous checkout (phone-verified buyer); we still
  -- record who reported it when signed in.
  customer_id uuid references auth.users(id) on delete set null,
  reporter_phone text not null default '' check (char_length(reporter_phone) <= 16),
  reason text not null
    check (reason in ('not_received', 'wrong_item', 'damaged', 'defective', 'fake', 'refund_request', 'other')),
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'refunded', 'rejected')),
  seller_note text not null default '' check (char_length(seller_note) <= 500),
  refund_kobo bigint not null default 0 check (refund_kobo >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one OPEN dispute per order (re-reporting while one is live is a bug).
create unique index if not exists disputes_one_open_per_order
  on public.disputes (order_id) where status = 'open';
create index if not exists disputes_store_idx on public.disputes (store_id, status, created_at);
create index if not exists disputes_order_idx on public.disputes (order_id);

alter table public.disputes enable row level security;

drop policy if exists "disputes customer insert" on public.disputes;
create policy "disputes customer insert"
  on public.disputes
  for insert to authenticated
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.store_id = disputes.store_id
        and o.customer_id = auth.uid()
    )
  );

-- Buyer reads disputes on their own orders (RLS via orders.customer_id).
drop policy if exists "disputes buyer read" on public.disputes;
create policy "disputes buyer read"
  on public.disputes
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

-- Store owner/staff read + respond to disputes on their store.
drop policy if exists "disputes seller read" on public.disputes;
create policy "disputes seller read"
  on public.disputes
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

drop policy if exists "disputes seller update" on public.disputes;
create policy "disputes seller update"
  on public.disputes
  for update to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

grant select, insert, update on public.disputes to authenticated;
grant select on public.disputes to anon; -- checkout page shows dispute state by order id

create trigger trg_disputes_updated before update on public.disputes
  for each row execute function public.set_updated_at();

-- ============ 3. store_follows ============
create table if not exists public.store_follows (
  customer_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, store_id)
);
create index if not exists store_follows_store_idx on public.store_follows (store_id);

alter table public.store_follows enable row level security;

drop policy if exists "follows self all" on public.store_follows;
create policy "follows self all"
  on public.store_follows
  for all to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

-- Public read so store pages can show a follower count.
drop policy if exists "follows public read" on public.store_follows;
create policy "follows public read"
  on public.store_follows
  for select using (true);

grant select, insert, delete on public.store_follows to authenticated;
grant select on public.store_follows to anon;

-- ============ 4. alerts ============
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  kind text not null
    check (kind in ('new_product', 'price_drop', 'order_update', 'booking_update', 'chat', 'dispute_update')),
  title text not null check (char_length(title) between 1 and 140),
  body text not null default '' check (char_length(body) <= 400),
  href text not null default '' check (char_length(href) <= 300),
  store_id uuid references public.stores(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists alerts_inbox_idx on public.alerts (customer_id, created_at desc);
create index if not exists alerts_unread_idx on public.alerts (customer_id) where read_at is null;

alter table public.alerts enable row level security;

drop policy if exists "alerts self read" on public.alerts;
create policy "alerts self read"
  on public.alerts
  for select to authenticated using (customer_id = auth.uid());
drop policy if exists "alerts self update" on public.alerts;
create policy "alerts self update"
  on public.alerts
  for update to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());
drop policy if exists "alerts self delete" on public.alerts;
create policy "alerts self delete"
  on public.alerts
  for delete to authenticated using (customer_id = auth.uid());

grant select, update, delete on public.alerts to authenticated;
-- Inserts come from triggers (SECURITY DEFINER below) and service-role routes.

-- ============ fan-out triggers ============
-- New listing -> alert every follower of the store.
create or replace function public.alert_followers_new_listing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into alerts (customer_id, kind, title, body, href, store_id, listing_id)
  select f.customer_id,
         'new_product',
         'New in ' || s.name,
         left(new.title || ' — ₦' || (new.price_kobo / 100), 390),
         '/s/' || s.slug || '/listing/' || new.id,
         new.store_id,
         new.id
  from store_follows f
  join stores s on s.id = f.store_id
  where f.store_id = new.store_id
    and new.type <> 'service';
  return new;
end $$;

drop trigger if exists trg_alert_new_listing on public.listings;
create trigger trg_alert_new_listing
  after insert on public.listings
  for each row execute function public.alert_followers_new_listing();

-- Price drop -> alert followers AND buyers who have the item in past orders.
create or replace function public.alert_price_drop()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.price_kobo <> old.price_kobo and new.price_kobo < old.price_kobo then
    insert into alerts (customer_id, kind, title, body, href, store_id, listing_id)
    select distinct x.customer_id,
           'price_drop',
           'Price drop: ' || left(new.title, 90),
           'Now ₦' || (new.price_kobo / 100) || ' (was ₦' || (old.price_kobo / 100) || ') at ' || s.name,
           '/s/' || s.slug || '/listing/' || new.id,
           new.store_id,
           new.id
    from (
      select f.customer_id from store_follows f where f.store_id = new.store_id
      union
      select o.customer_id from order_items oi
        join orders o on o.id = oi.order_id
      where oi.listing_id = new.id and o.customer_id is not null
    ) x
    join stores s on s.id = new.store_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_alert_price_drop on public.listings;
create trigger trg_alert_price_drop
  after update of price_kobo on public.listings
  for each row execute function public.alert_price_drop();

-- Order status changes -> alert the buyer (service role flips paid, sellers
-- fulfil/cancel/refund — neither can insert into alerts under their own RLS).
create or replace function public.alert_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null and new.status is distinct from old.status then
    insert into alerts (customer_id, kind, title, body, href, store_id)
    values (
      new.customer_id,
      'order_update',
      case new.status
        when 'paid' then 'Payment received'
        when 'fulfilled' then 'Order completed'
        when 'cancelled' then 'Order cancelled'
        when 'refunded' then 'Refund issued'
        else 'Order update'
      end,
      left('Order #' || left(new.id::text, 8) || ' is now ' || new.status || ' — ₦' || (new.total_kobo / 100) || ' (' || coalesce(nullif(new.delivery_method, ''), 'delivery') || ')', 390),
      '/account',
      new.store_id
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_alert_order_status on public.orders;
create trigger trg_alert_order_status
  after update of status on public.orders
  for each row execute function public.alert_order_status_change();

-- Booking status changes -> alert the buyer.
create or replace function public.alert_booking_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null and new.status is distinct from old.status then
    insert into alerts (customer_id, kind, title, body, href, store_id)
    values (
      new.customer_id,
      'booking_update',
      case new.status
        when 'confirmed' then 'Booking confirmed'
        when 'completed' then 'Booking completed'
        when 'cancelled' then 'Booking cancelled'
        else 'Booking update'
      end,
      left('Your appointment on ' || to_char(new.slot_start at time zone 'Africa/Lagos', 'Dy DD Mon, HH24:MI') || ' is now ' || new.status || '.', 390),
      '/account/bookings',
      (select store_id from listings l where l.id = new.listing_id)
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_alert_booking_status on public.bookings;
create trigger trg_alert_booking_status
  after update of status on public.bookings
  for each row execute function public.alert_booking_status_change();

-- Seller replies in chat -> alert the customer (customer->seller needs no
-- alert: the dashboard inbox already badges unread threads).
create or replace function public.alert_chat_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sender = 'seller' and new.customer_id is not null then
    insert into alerts (customer_id, kind, title, body, href, store_id)
    values (
      new.customer_id,
      'chat',
      'New message from ' || coalesce((select name from stores s where s.id = new.store_id), 'a store'),
      left(new.body, 300),
      '/account/chats',
      new.store_id
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_alert_chat on public.chat_messages;
create trigger trg_alert_chat
  after insert on public.chat_messages
  for each row execute function public.alert_chat_message();

-- Dispute resolved / refunded / rejected -> alert the buyer.
create or replace function public.alert_dispute_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.customer_id is not null then
    insert into alerts (customer_id, kind, title, body, href, store_id)
    values (
      new.customer_id,
      'dispute_update',
      case new.status
        when 'refunded' then 'Refund issued'
        when 'resolved' then 'Report resolved'
        when 'rejected' then 'Report reviewed — no refund'
        else 'Dispute update'
      end,
      left(case when new.seller_note <> '' then new.seller_note else 'The store replied to your report on order #' || left(new.order_id::text, 8) || '.' end, 390),
      '/account',
      new.store_id
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_alert_dispute on public.disputes;
create trigger trg_alert_dispute
  after update of status on public.disputes
  for each row execute function public.alert_dispute_update();

-- ============ 5. store_reports ("Report this store" from any store page) ============
create table if not exists public.store_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_phone text not null default '' check (char_length(reporter_phone) <= 16),
  reason text not null
    check (reason in ('scam', 'fake_goods', 'no_response', 'wrong_product', 'abuse', 'other')),
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists store_reports_store_idx on public.store_reports (store_id, status, created_at);

alter table public.store_reports enable row level security;

drop policy if exists "store_reports insert" on public.store_reports;
create policy "store_reports insert"
  on public.store_reports
  for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "store_reports reporter read" on public.store_reports;
create policy "store_reports reporter read"
  on public.store_reports
  for select to authenticated using (reporter_id = auth.uid());

drop policy if exists "store_reports seller read" on public.store_reports;
create policy "store_reports seller read"
  on public.store_reports
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

drop policy if exists "store_reports seller update" on public.store_reports;
create policy "store_reports seller update"
  on public.store_reports
  for update to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

grant select, insert, update on public.store_reports to authenticated;
