-- I1 follow-up: orders.customer_id references customers(id). A signed-in seller
-- (not a customer) placing an order would hit the foreign key and lose the
-- order. Keep customer_id only when the caller is a real customer row.

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
  if v_customer is not null and not exists (select 1 from public.customers where id = v_customer) then
    v_customer := null; -- sellers and staff order as guests
  end if;

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
