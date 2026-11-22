-- I1: server-calculated orders (INFRASTRUCTURE.md section 4.3).
--
-- create_order_atomic trusted the total, discount, delivery fee and customer id
-- it was given, and signed-in users could call it straight through PostgREST.
-- create_order_v2 takes only ids, quantities, a delivery choice and a discount
-- code, and works out every amount from the database in one transaction.
--
-- Also here:
--   * orders.order_code  public code, KV-1001 upwards
--   * orders.idempotency_key  the same key returns the same order
--   * discount_codes.min_order_kobo  optional minimum order for a code
--   * order_rate_events  per-phone and per-IP order limits (hashed, server only)
--   * create_pos_order  replaces the POS call to create_order_atomic
--   * create_order_atomic and decrement_listing_stock are closed to signed-in users

-- ---------------------------------------------------------------- columns

create sequence if not exists public.order_code_seq start with 1001;

alter table public.orders add column if not exists order_code text;
update public.orders set order_code = 'KV-' || nextval('public.order_code_seq') where order_code is null;
alter table public.orders alter column order_code set default ('KV-' || nextval('public.order_code_seq'));
alter table public.orders alter column order_code set not null;
create unique index if not exists orders_order_code_key on public.orders (order_code);

alter table public.orders add column if not exists idempotency_key uuid;
create unique index if not exists orders_idempotency_key_key on public.orders (idempotency_key);

-- Sellers may insert orders for their own store through RLS; the default needs the sequence.
grant usage on sequence public.order_code_seq to authenticated, service_role;

alter table public.discount_codes add column if not exists min_order_kobo bigint;
alter table public.discount_codes drop constraint if exists discount_codes_min_order_check;
alter table public.discount_codes
  add constraint discount_codes_min_order_check check (min_order_kobo is null or min_order_kobo >= 0);

-- ---------------------------------------------------------------- rate limits

create table if not exists public.order_rate_events (
  id bigint generated always as identity primary key,
  bucket text not null, -- 'phone:<sha256>' or 'ip:<sha256>', never the raw value
  created_at timestamptz not null default now()
);
create index if not exists order_rate_events_bucket_time on public.order_rate_events (bucket, created_at desc);
alter table public.order_rate_events enable row level security;
revoke all on public.order_rate_events from anon, authenticated;

-- ---------------------------------------------------------------- helpers

-- Turn [{listing_id, quantity}, ...] into sorted, merged arrays. Sorting gives a
-- fixed lock order on listings, so two orders never deadlock each other.
create or replace function public.order_lines_from_json(p_items jsonb, out ids uuid[], out qtys int[])
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or jsonb_typeof(e -> 'listing_id') <> 'string'
       or jsonb_typeof(e -> 'quantity') <> 'number'
       or (e ->> 'listing_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or (e ->> 'quantity') !~ '^[0-9]+$'
  ) then
    raise exception 'INVALID_ITEMS';
  end if;

  select array_agg(lid order by lid), array_agg(q order by lid)
    into ids, qtys
  from (
    select (e ->> 'listing_id')::uuid as lid, sum(least((e ->> 'quantity')::numeric, 1000))::int as q
    from jsonb_array_elements(p_items) e
    group by 1
  ) s;

  if array_length(ids, 1) > 30 then
    raise exception 'TOO_MANY_LINES';
  end if;
  if exists (select 1 from unnest(qtys) q where q < 1 or q > 50) then
    raise exception 'BAD_QUANTITY';
  end if;
end $$;

revoke all on function public.order_lines_from_json(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- create_order_v2

create or replace function public.create_order_v2(
  p_store_id uuid,
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_method text default '',
  p_delivery_zone text default '',
  p_discount_code text default null,
  p_payment_method text default '',
  p_idempotency_key uuid default null,
  p_delivery_area text default '',
  p_delivery_address text default '',
  p_delivery_landmark text default '',
  p_delivery_note text default '',
  p_drop_lat double precision default null,
  p_drop_lng double precision default null,
  p_customer_id uuid default null, -- honoured only for the service role (verified by the server)
  p_client_ip text default null    -- honoured only for the service role
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_is_service boolean := coalesce(v_claims ->> 'role', '') = 'service_role';
  v_headers jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  v_customer uuid;
  v_ip text;
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
  v_method text := btrim(coalesce(p_delivery_method, ''));
  v_zone text := btrim(coalesce(p_delivery_zone, ''));
  v_pay text := btrim(coalesce(p_payment_method, ''));
  v_promo_in text := nullif(upper(btrim(coalesce(p_discount_code, ''))), '');
  v_delivering boolean;
  v_ids uuid[];
  v_qtys int[];
  v_store record;
  v_promo record;
  v_opt jsonb;
  v_found int;
  v_gross bigint;
  v_discount bigint := 0;
  v_fee bigint := 0;
  v_total bigint;
  v_code text := null;
  v_row public.orders%rowtype;
  v_i int;
begin
  v_customer := case when v_is_service then p_customer_id else auth.uid() end;
  v_ip := case
    when v_is_service then nullif(btrim(coalesce(p_client_ip, '')), '')
    else nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '')
  end;

  -- Replay: the same key returns the order it already made.
  if p_idempotency_key is not null then
    select * into v_row from public.orders where idempotency_key = p_idempotency_key;
    if found then
      if v_row.store_id <> p_store_id or v_row.customer_phone <> v_phone then
        raise exception 'IDEMPOTENCY_KEY_REUSED';
      end if;
      return jsonb_build_object(
        'order_id', v_row.id, 'order_code', v_row.order_code,
        'subtotal_kobo', v_row.total_kobo - v_row.delivery_fee_kobo + v_row.discount_kobo,
        'discount_kobo', v_row.discount_kobo, 'discount_code', v_row.discount_code,
        'delivery_fee_kobo', v_row.delivery_fee_kobo, 'total_kobo', v_row.total_kobo,
        'status', v_row.status, 'payment_status', v_row.payment_status, 'replayed', true);
    end if;
  end if;

  -- Buyer details.
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'INVALID_NAME';
  end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'INVALID_PHONE';
  end if;
  if v_pay not in ('', 'cash_on_delivery', 'bank_transfer', 'pay_on_pickup') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;
  if v_method not in ('', 'pickup', 'rider', 'courier', 'zone') then
    raise exception 'INVALID_DELIVERY';
  end if;
  v_delivering := v_method in ('rider', 'courier');
  if (p_drop_lat is null) <> (p_drop_lng is null)
     or (p_drop_lat is not null and not (p_drop_lat between 8.33 and 8.66 and p_drop_lng between 4.38 and 4.74)) then
    raise exception 'INVALID_PIN';
  end if;

  select * into v_ids, v_qtys from public.order_lines_from_json(p_items);

  -- Store.
  select id, is_example, delivery_options, plan, plan_expires_at
    into v_store
  from public.stores where id = p_store_id;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if v_store.is_example then
    raise exception 'EXAMPLE_STORE';
  end if;

  -- Items: prices come from listings, nowhere else.
  select count(*), coalesce(sum(l.price_kobo * x.q), 0)
    into v_found, v_gross
  from unnest(v_ids, v_qtys) as x(lid, q)
  join public.listings l on l.id = x.lid and l.store_id = p_store_id;
  if v_found <> array_length(v_ids, 1) then
    raise exception 'UNKNOWN_LISTING';
  end if;
  if exists (select 1 from public.listings l where l.id = any (v_ids) and l.type <> 'product') then
    raise exception 'NOT_ORDERABLE';
  end if;

  -- Delivery fee: from the store's own settings.
  if v_method = 'zone' then
    v_opt := v_store.delivery_options -> 'zones' -> v_zone;
    if v_zone = '' or v_opt is null or (v_opt ->> 'enabled') is distinct from 'true' then
      raise exception 'INVALID_ZONE';
    end if;
  elsif v_method <> '' then
    v_opt := v_store.delivery_options -> v_method;
    if v_opt is null or (v_opt ->> 'enabled') is distinct from 'true' then
      raise exception 'INVALID_DELIVERY';
    end if;
  end if;
  if v_opt is not null and jsonb_typeof(v_opt -> 'fee_kobo') = 'number' then
    v_fee := least(100000000, greatest(0, round((v_opt ->> 'fee_kobo')::numeric)))::bigint;
  end if;

  -- Discount: active code of this store, paid plan, under max uses, zone and minimum rules.
  if v_promo_in is not null then
    select * into v_promo from public.discount_codes where store_id = p_store_id and code = v_promo_in;
    if not found
       or not v_promo.active
       or (v_promo.max_uses is not null and v_promo.usage_count >= v_promo.max_uses)
       or not coalesce(v_store.plan in ('growth', 'plus', 'pro') and v_store.plan_expires_at > now(), false) then
      raise exception 'INVALID_PROMO';
    end if;
    if v_promo.zone_id is not null and (v_method <> 'zone' or v_zone <> v_promo.zone_id) then
      raise exception 'PROMO_ZONE:%', v_promo.zone_id;
    end if;
    if v_promo.min_order_kobo is not null and v_gross < v_promo.min_order_kobo then
      raise exception 'PROMO_MIN_ORDER:%', v_promo.min_order_kobo;
    end if;
    v_discount := least(v_gross, round(v_gross * greatest(0, least(100, v_promo.percent_off)) / 100.0)::bigint);
    v_code := v_promo.code;
  end if;

  v_total := greatest(0, v_gross - v_discount) + v_fee;

  -- Rate limits: 5 orders per phone and 20 per IP in 10 minutes.
  if (select count(*) from public.order_rate_events
      where bucket = 'phone:' || encode(extensions.digest(v_phone, 'sha256'), 'hex')
        and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'RATE_LIMITED';
  end if;
  if v_ip is not null and (select count(*) from public.order_rate_events
      where bucket = 'ip:' || encode(extensions.digest(v_ip, 'sha256'), 'hex')
        and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  -- Write the order. A concurrent request with the same key waits on the unique
  -- index, then gets the committed order back.
  begin
    insert into public.orders (
      store_id, customer_id, customer_name, customer_phone,
      total_kobo, discount_code, discount_kobo, delivery_fee_kobo,
      delivery_method, delivery_zone, delivery_area, delivery_address, delivery_landmark, delivery_note,
      drop_lat, drop_lng, payment_method, status, payment_status, channel, idempotency_key
    ) values (
      p_store_id, v_customer, v_name, v_phone,
      v_total, v_code, v_discount, v_fee,
      v_method,
      case when v_method = 'zone' then v_zone else '' end,
      case when v_delivering then left(btrim(coalesce(p_delivery_area, '')), 40) else '' end,
      case when v_method not in ('', 'pickup') then left(btrim(coalesce(p_delivery_address, '')), 200) else '' end,
      case when v_method not in ('', 'pickup') then left(btrim(coalesce(p_delivery_landmark, '')), 120) else '' end,
      left(btrim(coalesce(p_delivery_note, '')), 300),
      case when v_delivering then p_drop_lat end,
      case when v_delivering then p_drop_lng end,
      v_pay, 'pending', 'unpaid', 'online', p_idempotency_key
    )
    returning * into v_row;
  exception when unique_violation then
    if p_idempotency_key is null then
      raise;
    end if;
    select * into v_row from public.orders where idempotency_key = p_idempotency_key;
    if not found or v_row.store_id <> p_store_id or v_row.customer_phone <> v_phone then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return jsonb_build_object(
      'order_id', v_row.id, 'order_code', v_row.order_code,
      'subtotal_kobo', v_row.total_kobo - v_row.delivery_fee_kobo + v_row.discount_kobo,
      'discount_kobo', v_row.discount_kobo, 'discount_code', v_row.discount_code,
      'delivery_fee_kobo', v_row.delivery_fee_kobo, 'total_kobo', v_row.total_kobo,
      'status', v_row.status, 'payment_status', v_row.payment_status, 'replayed', true);
  end;

  insert into public.order_items (order_id, listing_id, quantity, unit_price_kobo)
  select v_row.id, l.id, x.q, l.price_kobo
  from unnest(v_ids, v_qtys) as x(lid, q)
  join public.listings l on l.id = x.lid;

  -- Raises INSUFFICIENT_STOCK, which rolls back the whole order.
  for v_i in 1 .. array_length(v_ids, 1) loop
    perform public.decrement_listing_stock(v_ids[v_i], v_qtys[v_i]);
  end loop;

  if v_code is not null then
    update public.discount_codes
       set usage_count = usage_count + 1
     where store_id = p_store_id and code = v_code and active
       and (max_uses is null or usage_count < max_uses);
    if not found then
      raise exception 'INVALID_PROMO'; -- the last use went to someone else a moment ago
    end if;
  end if;

  insert into public.order_rate_events (bucket)
  values ('phone:' || encode(extensions.digest(v_phone, 'sha256'), 'hex'));
  if v_ip is not null then
    insert into public.order_rate_events (bucket)
    values ('ip:' || encode(extensions.digest(v_ip, 'sha256'), 'hex'));
  end if;

  return jsonb_build_object(
    'order_id', v_row.id, 'order_code', v_row.order_code,
    'subtotal_kobo', v_gross, 'discount_kobo', v_discount, 'discount_code', v_code,
    'delivery_fee_kobo', v_fee, 'total_kobo', v_total,
    'status', v_row.status, 'payment_status', v_row.payment_status, 'replayed', false);
end $$;

revoke all on function public.create_order_v2(
  uuid, jsonb, text, text, text, text, text, text, uuid, text, text, text, text,
  double precision, double precision, uuid, text
) from public;
grant execute on function public.create_order_v2(
  uuid, jsonb, text, text, text, text, text, text, uuid, text, text, text, text,
  double precision, double precision, uuid, text
) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- create_pos_order

-- In-person sale at the POS. The caller must be the store owner or active staff.
-- Money is taken at the counter, so the order is recorded as paid.
create or replace function public.create_pos_order(p_store_id uuid, p_items jsonb, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_staff uuid;
  v_ids uuid[];
  v_qtys int[];
  v_found int;
  v_total bigint;
  v_row public.orders%rowtype;
  v_i int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHORISED';
  end if;
  select owner_id into v_owner from public.stores where id = p_store_id;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if v_owner is distinct from v_uid then
    select id into v_staff from public.store_staff
     where store_id = p_store_id and user_id = v_uid and active
     order by created_at limit 1;
    if v_staff is null then
      raise exception 'NOT_AUTHORISED';
    end if;
  end if;
  if p_method not in ('cash', 'transfer', 'card') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  select * into v_ids, v_qtys from public.order_lines_from_json(p_items);

  select count(*), coalesce(sum(l.price_kobo * x.q), 0)
    into v_found, v_total
  from unnest(v_ids, v_qtys) as x(lid, q)
  join public.listings l on l.id = x.lid and l.store_id = p_store_id;
  if v_found <> array_length(v_ids, 1) then
    raise exception 'UNKNOWN_LISTING';
  end if;
  if exists (select 1 from public.listings l where l.id = any (v_ids) and l.type <> 'product') then
    raise exception 'NOT_ORDERABLE';
  end if;

  insert into public.orders (
    store_id, customer_name, customer_phone, total_kobo, status, payment_status,
    payment_method, payment_confirmed_at, channel, pos_staff_id
  ) values (
    p_store_id, 'Walk-in customer', '0000000000', v_total, 'paid', 'paid',
    case when p_method = 'transfer' then 'bank_transfer' else 'other' end,
    now(), 'pos', v_staff
  )
  returning * into v_row;

  insert into public.order_items (order_id, listing_id, quantity, unit_price_kobo)
  select v_row.id, l.id, x.q, l.price_kobo
  from unnest(v_ids, v_qtys) as x(lid, q)
  join public.listings l on l.id = x.lid;

  for v_i in 1 .. array_length(v_ids, 1) loop
    perform public.decrement_listing_stock(v_ids[v_i], v_qtys[v_i]);
  end loop;

  return jsonb_build_object('order_id', v_row.id, 'order_code', v_row.order_code, 'total_kobo', v_total);
end $$;

revoke all on function public.create_pos_order(uuid, jsonb, text) from public, anon;
grant execute on function public.create_pos_order(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------- close the old path

-- Signed-in users could call this with any total. Production checkout still
-- calls it with the service role until the new route is deployed; drop it in a
-- later migration once nothing calls it.
revoke execute on function public.create_order_atomic(
  uuid, text, text, json, json, text, text, integer, uuid, integer, integer
) from public, anon, authenticated;

-- Only the order functions above (running as owner) decrement stock now.
revoke execute on function public.decrement_listing_stock(uuid, integer) from public, anon, authenticated;

-- Buyer alerts show the public order code instead of a slice of the uuid.
create or replace function public.alert_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
      left('Order ' || coalesce(new.order_code, left(new.id::text, 8)) || ' is now ' || new.status || ' — ₦' || (new.total_kobo / 100), 390),
      '/account',
      new.store_id
    );
  end if;
  return new;
end $$;
