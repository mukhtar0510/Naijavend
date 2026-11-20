-- Repair: create_order_atomic.
--
-- The original 20261003000001 file never worked — its loop used `foreach ... as`
-- (invalid PL/pgSQL) and declared variables inside the loop body, so the function
-- was rejected by Postgres and never existed in any environment. Both callers
-- (/api/create-order and /api/pos/charge) call it with no fallback, so every
-- checkout and POS charge failed once this path was reached.
--
-- This replaces the broken definition with a version that actually runs, and
-- extends it with the columns the checkout route needs (customer attribution,
-- delivery fee, discount amount) so the route no longer has to pre-insert a
-- row and risk a duplicate order.
--
-- Signature note: the three new parameters have defaults, and the old 8-argument
-- signature never existed, so there is nothing to overload.

drop function if exists public.create_order_atomic(uuid, text, text, json, json, text, text, integer);

create or replace function public.create_order_atomic(
  p_store_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_listing_ids json,
  p_quantities json,
  p_discount_code text,
  p_delivery_method text,
  p_total_kobo integer,
  p_customer_id uuid default null,
  p_delivery_fee_kobo integer default 0,
  p_discount_kobo integer default 0
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_ids uuid[];
  v_qtys int[];
  v_i int;
  -- Callers pass JSON.stringify(...), which PostgREST delivers as a json string
  -- scalar rather than an array. Normalise both shapes here so the function
  -- works whichever way it is called.
  v_ids_json json := case
    when p_listing_ids is null then '[]'::json
    when json_typeof(p_listing_ids) = 'string' then (p_listing_ids #>> '{}')::json
    else p_listing_ids
  end;
  v_qtys_json json := case
    when p_quantities is null then '[]'::json
    when json_typeof(p_quantities) = 'string' then (p_quantities #>> '{}')::json
    else p_quantities
  end;
begin
  v_ids := array(select (json_array_elements_text(v_ids_json))::uuid);
  v_qtys := array(select (json_array_elements_text(v_qtys_json))::int);

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'EMPTY_CART' using hint = 'An order needs at least one item.';
  end if;
  if array_length(v_ids, 1) is distinct from array_length(v_qtys, 1) then
    raise exception 'ITEM_MISMATCH' using hint = 'Listing and quantity counts differ.';
  end if;

  insert into public.orders (
    store_id, customer_id, customer_name, customer_phone, total_kobo,
    discount_code, discount_kobo, delivery_fee_kobo, delivery_method, status
  ) values (
    p_store_id, p_customer_id, p_customer_name, p_customer_phone, p_total_kobo,
    p_discount_code, greatest(0, coalesce(p_discount_kobo, 0)), greatest(0, coalesce(p_delivery_fee_kobo, 0)),
    p_delivery_method, 'pending'
  )
  returning id into v_order_id;

  -- Items are priced from the database, never from the client.
  for v_i in 1 .. array_length(v_ids, 1) loop
    insert into public.order_items (order_id, listing_id, quantity, unit_price_kobo)
    select v_order_id, l.id, greatest(1, v_qtys[v_i]), l.price_kobo
    from public.listings l
    where l.id = v_ids[v_i] and l.store_id = p_store_id;

    if not found then
      raise exception 'UNKNOWN_LISTING' using hint = 'A listing in this order does not belong to the store.';
    end if;

    -- Raises INSUFFICIENT_STOCK if stock is short; that rolls back the whole call.
    perform public.decrement_listing_stock(v_ids[v_i], greatest(1, v_qtys[v_i]));
  end loop;

  if p_discount_code is not null then
    update public.discount_codes
    set usage_count = usage_count + 1
    where code = p_discount_code
      and store_id = p_store_id
      and active = true
      and (max_uses is null or usage_count < max_uses);
  end if;

  return json_build_object('order_id', v_order_id::text, 'status', 'pending');
end;
$$;

grant execute on function public.create_order_atomic(
  uuid, text, text, json, json, text, text, integer, uuid, integer, integer
) to anon, authenticated, service_role;
