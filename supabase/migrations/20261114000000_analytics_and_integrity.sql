-- R5 — Analytics efficiency + remaining R2 hardening.
--
-- The seller analytics page used to pull up to 5,000 raw store_events rows into
-- Node and count them in JavaScript. These views do the counting in Postgres so
-- the page reads a handful of pre-aggregated rows instead.
--
-- All views are created with security_invoker = true: without it a view runs
-- with its owner's privileges and would bypass the RLS policies on the base
-- tables, leaking every store's traffic to any signed-in seller. With it, the
-- seller's own RLS rules still decide which rows are visible.

-- ---------------------------------------------------------------------------
-- Daily event counts, one row per store / day / event type.
-- ---------------------------------------------------------------------------
create or replace view public.store_events_daily
with (security_invoker = true) as
select
  store_id,
  (created_at at time zone 'UTC')::date as day,
  event_type,
  count(*)::bigint as event_count
from public.store_events
group by store_id, (created_at at time zone 'UTC')::date, event_type;

comment on view public.store_events_daily is
  'Per-store daily analytics counts. Replaces loading raw store_events rows into the app.';

-- ---------------------------------------------------------------------------
-- Daily referrer counts. The label ("Home page", "Search", "WhatsApp", ...) is
-- still chosen in the app (classifyTrafficSource) so the grouping rules stay in
-- one place — this view just collapses the raw rows to (referrer, source) pairs.
-- ---------------------------------------------------------------------------
create or replace view public.store_referrer_daily
with (security_invoker = true) as
select
  store_id,
  (created_at at time zone 'UTC')::date as day,
  coalesce(referrer, '') as referrer,
  coalesce(source, '') as source,
  count(*)::bigint as event_count
from public.store_events
where event_type = 'view'
group by store_id, (created_at at time zone 'UTC')::date, coalesce(referrer, ''), coalesce(source, '');

comment on view public.store_referrer_daily is
  'Daily store-view counts grouped by raw referrer/source; labels are applied client-side.';

-- ---------------------------------------------------------------------------
-- Daily paid sales, so revenue trends never require reading every order.
-- ---------------------------------------------------------------------------
create or replace view public.store_sales_daily
with (security_invoker = true) as
select
  store_id,
  (created_at at time zone 'UTC')::date as day,
  count(*)::bigint as order_count,
  coalesce(sum(total_kobo), 0)::bigint as revenue_kobo
from public.orders
where status in ('paid', 'fulfilled')
group by store_id, (created_at at time zone 'UTC')::date;

comment on view public.store_sales_daily is
  'Per-store daily paid order count and revenue (kobo).';

-- ---------------------------------------------------------------------------
-- Platform-wide daily activity for the superadmin console. security_invoker
-- keeps this readable only by rows the caller's RLS allows; the admin routes
-- read it through the service role, which sees everything.
-- ---------------------------------------------------------------------------
create or replace view public.platform_activity_daily
with (security_invoker = true) as
select
  d.day,
  coalesce(u.new_accounts, 0)::bigint as new_accounts,
  coalesce(s.new_stores, 0)::bigint as new_stores,
  coalesce(o.order_count, 0)::bigint as paid_orders,
  coalesce(o.revenue_kobo, 0)::bigint as revenue_kobo
from (
  select generate_series(
    (now() at time zone 'UTC')::date - 29,
    (now() at time zone 'UTC')::date,
    interval '1 day'
  )::date as day
) d
left join (
  select (created_at at time zone 'UTC')::date as day, count(*) as new_accounts
  from public.users_overview
  group by 1
) u on u.day = d.day
left join (
  select (created_at at time zone 'UTC')::date as day, count(*) as new_stores
  from public.stores
  group by 1
) s on s.day = d.day
left join (
  select
    (created_at at time zone 'UTC')::date as day,
    count(*) as order_count,
    coalesce(sum(total_kobo), 0) as revenue_kobo
  from public.orders
  where status in ('paid', 'fulfilled')
  group by 1
) o on o.day = d.day;

comment on view public.platform_activity_daily is
  'Last 30 days of platform-wide signups, stores, paid orders and GMV.';

-- ---------------------------------------------------------------------------
-- R2 leftovers.
-- ---------------------------------------------------------------------------

-- Stock can never go negative, even if a future code path forgets the RPC.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'listings_stock_non_negative'
  ) then
    alter table public.listings
      add constraint listings_stock_non_negative
      check (stock is null or stock >= 0) not valid;
  end if;
end $$;

-- Branch `position` was computed in the browser (existing.length + 1), which
-- produced duplicates and gaps after deletions. Assign it in the database and
-- backfill any existing store that already drifted.
create or replace function public.set_store_location_position()
returns trigger language plpgsql as $$
begin
  if new.position is null or new.position < 1 then
    select coalesce(max(position), 0) + 1
      into new.position
      from public.store_locations
      where store_id = new.store_id;
  end if;
  return new;
end $$;

drop trigger if exists store_locations_position on public.store_locations;
create trigger store_locations_position
  before insert on public.store_locations
  for each row execute function public.set_store_location_position();

with ranked as (
  select id,
         row_number() over (partition by store_id order by position, id) as rn
  from public.store_locations
)
update public.store_locations l
   set position = r.rn
  from ranked r
 where l.id = r.id
   and l.position is distinct from r.rn;
