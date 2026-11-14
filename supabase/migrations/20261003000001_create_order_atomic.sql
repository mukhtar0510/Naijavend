-- Atomic order creation: order + items + stock decrement + promo increment in one transaction.
-- This RPC replaces the ~4 separate writes in create-order and pos/charge,
-- preventing half-written state when a failure occurs between them.
--
-- Usage from routes: sb.rpc('create_order_atomic', {
--   p_store_id: store.id,
--   p_customer_name: customerName,
--   p_customer_phone: customerPhone,
--   p_listing_ids: listingIds,   -- json array of listing ids
--   p_quantities: quantities,     -- json array of quantities matching listings
--   p_discount_code: appliedCode, -- null if no promo
--   p_delivery_method: deliveryMethod,
--   p_total_kobo: totalKobo,
-- })
-- Returns: { order_id: uuid, status: text }
create or replace function public.create_order_atomic(
  p_store_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_listing_ids json,
  p_quantities json,
  p_discount_code text,
  p_delivery_method text,
  p_total_kobo integer
) returns json language plpgsql as $$
declare
  v_order_id uuid;
  v_discount_kobo integer;
  v_applied_code text := p_discount_code;
begin
  -- Insert the order and capture the ID, status
  insert into public.orders (store_id, customer_name, customer_phone, total_kobo, discount_code, discount_kobo, delivery_method, status)
  values (p_store_id, p_customer_name, p_customer_phone, p_total_kobo, p_discount_code, 0, p_delivery_method, 'pending')
  returning id, discount_kobo into v_order_id, v_discount_kobo;

  -- Insert order items atomically
  insert into public.order_items (order_id, listing_id, quantity, unit_price_kobo)
  select v_order_id, unnest(p_listing_ids::uuid[]), unnest(p_quantities::int[]), price_kobo
  from public.listings
  where id = any(p_listing_ids::uuid[]);

  -- Atomically decrement stock for each listing (uses the existing safe RPC)
  -- We loop here because Postgres doesn't easily array-map to an RPC call,
  -- but each decrement is itself atomic and will raise INSUFFICIENT_STOCK if needed.
  -- If any decrement fails, we roll back the entire transaction.
  -- Note: This still needs the surrounding route to catch the error and rollback.
  foreach p_listing_ids as idx loop
    declare
      v_listing uuid := p_listing_ids[idx];
      v_quantity int := (p_quantities->>idx)::int;
    begin
      perform public.decrement_listing_stock(v_listing, v_quantity);
    end;
  end loop;

  -- Atomically increment promo usage count in one statement
  if p_discount_code is not null then
    update public.discount_codes
    set usage_count = usage_count + 1
    where code = p_discount_code and store_id = p_store_id
      and active = true
      and (max_uses is null or usage_count < max_uses);
  end if;

  -- Return the order id and status
  return json_build_object('order_id', v_order_id::text, 'status', 'pending');
end;
$$;