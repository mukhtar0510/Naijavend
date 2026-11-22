-- Security hardening pass (22 Nov 2026). Every hole closed here was proven
-- against the live database first (inside a rolled-back transaction):
--
--   1. create_order_atomic was callable by anon with a client-chosen total
--      (a ₦18,000 item ordered for 1 kobo) and by any signed-in user against
--      ANY store (fake orders, stock drained). Now: no anon access, the total
--      is computed in the database, and signed-in callers must be the owner or
--      active staff of that store.
--   2. Direct inserts into orders / order_items / bookings / store_ratings
--      were open to everyone (fake "paid" orders with a spoofed customer_id,
--      fake reviews to farm the blue tick). Every legitimate write already
--      goes through server routes using the service role, so the public
--      insert policies are dropped.
--   3. Sellers could PATCH their own store to verification_status='verified'
--      (blue tick without 30 reviews) or flip is_example. The plan guard now
--      also protects those columns.
--   4. onboarding_funnel_events was readable by anyone (user ids + steps).
--   5. store_follows was readable by anyone (which customer follows which
--      store). Customers still see and manage their own rows.
--   6. store_ratings.customer_phone was readable by anyone (every reviewer's
--      phone number). The column is now hidden from anon/authenticated.
--   7. Anyone could LIST every object in the public store-media bucket
--      (payment receipts, plan receipts). Public URLs keep working; listing is
--      limited to a user's own folder.
--   8. Digital products moved to a PRIVATE bucket: they lived in the public
--      store-media bucket and listings.digital_file_path is public, so a paid
--      file could be downloaded free.
--   9. POS staff (listings_pos_staff) could change any listing column (price,
--      title...). Staff may now change stock only.
--  10. Leftover test function mig_probe dropped.

-- ---------------------------------------------------------------- 1. orders RPC
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
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_ids uuid[];
  v_qtys int[];
  v_i int;
  v_price int;
  v_gross bigint := 0;
  v_discount bigint := 0;
  v_fee bigint := greatest(0, coalesce(p_delivery_fee_kobo, 0));
  v_customer uuid := p_customer_id;
  v_code text := p_discount_code;
  v_pct int;
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
  -- Signed-in callers (the POS) act for their own store only. The service
  -- role (online checkout) has no auth.uid() and is trusted for customer
  -- attribution and delivery fee, which it computes from the store's options.
  if v_uid is not null then
    if not exists (
      select 1 from public.stores s
      where s.id = p_store_id
        and (s.owner_id = v_uid or exists (
          select 1 from public.store_staff st
          where st.store_id = s.id and st.user_id = v_uid and st.active))
    ) then
      raise exception 'NOT_AUTHORISED' using hint = 'Only the store owner or active staff can record sales.';
    end if;
    v_customer := null;
    v_fee := 0;
    v_code := null;
  end if;

  v_ids := array(select (json_array_elements_text(v_ids_json))::uuid);
  v_qtys := array(select (json_array_elements_text(v_qtys_json))::int);

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'EMPTY_CART' using hint = 'An order needs at least one item.';
  end if;
  if array_length(v_ids, 1) > 100 then
    raise exception 'TOO_MANY_ITEMS';
  end if;
  if array_length(v_ids, 1) is distinct from array_length(v_qtys, 1) then
    raise exception 'ITEM_MISMATCH' using hint = 'Listing and quantity counts differ.';
  end if;

  insert into public.orders (
    store_id, customer_id, customer_name, customer_phone, total_kobo,
    discount_code, discount_kobo, delivery_fee_kobo, delivery_method, status
  ) values (
    p_store_id, v_customer, p_customer_name, p_customer_phone, 0,
    null, 0, v_fee, p_delivery_method, 'pending'
  )
  returning id into v_order_id;

  -- Items AND the total are priced from the database, never from the caller.
  for v_i in 1 .. array_length(v_ids, 1) loop
    if v_qtys[v_i] is null or v_qtys[v_i] < 1 or v_qtys[v_i] > 1000 then
      raise exception 'BAD_QUANTITY';
    end if;

    select l.price_kobo into v_price
    from public.listings l
    where l.id = v_ids[v_i] and l.store_id = p_store_id;
    if not found then
      raise exception 'UNKNOWN_LISTING' using hint = 'A listing in this order does not belong to the store.';
    end if;

    insert into public.order_items (order_id, listing_id, quantity, unit_price_kobo)
    values (v_order_id, v_ids[v_i], v_qtys[v_i], v_price);
    v_gross := v_gross + v_price::bigint * v_qtys[v_i];

    perform public.decrement_listing_stock(v_ids[v_i], v_qtys[v_i]);
  end loop;

  if v_code is not null then
    update public.discount_codes
    set usage_count = usage_count + 1
    where code = v_code
      and store_id = p_store_id
      and active = true
      and (max_uses is null or usage_count < max_uses)
    returning percent_off into v_pct;
    if v_pct is not null then
      v_discount := round(v_gross * v_pct / 100.0);
    else
      v_code := null;
    end if;
  end if;

  update public.orders
  set total_kobo = (greatest(0, v_gross - v_discount) + v_fee)::int,
      discount_code = v_code,
      discount_kobo = v_discount::int
  where id = v_order_id;

  return json_build_object(
    'order_id', v_order_id::text,
    'status', 'pending',
    'total_kobo', greatest(0, v_gross - v_discount) + v_fee
  );
end;
$$;

revoke all on function public.create_order_atomic(uuid, text, text, json, json, text, text, integer, uuid, integer, integer) from public, anon;
grant execute on function public.create_order_atomic(uuid, text, text, json, json, text, text, integer, uuid, integer, integer) to authenticated, service_role;

-- decrement_listing_stock is SECURITY INVOKER, so RLS already stops a stranger
-- from changing stock, but nothing outside create_order_atomic needs it.
revoke all on function public.decrement_listing_stock(uuid, integer) from public, anon;

-- ------------------------------------------------- 2. no direct public inserts
drop policy if exists orders_public_insert on public.orders;
drop policy if exists order_items_public_insert on public.order_items;
drop policy if exists bookings_public_insert on public.bookings;
drop policy if exists ratings_public_insert on public.store_ratings;

-- ------------------------------ 3. plan, verification and example are guarded
create or replace function public.guard_store_plan()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new; -- service role: confirmed payments, admin, verification route
  end if;
  if tg_op = 'INSERT' then
    new.plan := 'free';
    new.plan_expires_at := null;
    new.rider_expires_at := null;
    new.verification_status := 'unverified';
    new.verified_at := null;
    new.is_example := false;
    return new;
  end if;
  if new.plan is distinct from old.plan
     or new.plan_expires_at is distinct from old.plan_expires_at
     or new.rider_expires_at is distinct from old.rider_expires_at then
    raise exception 'Plans change only after a confirmed payment';
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.verified_at is distinct from old.verified_at
     or new.is_example is distinct from old.is_example
     or new.owner_id is distinct from old.owner_id then
    raise exception 'Verification, example and ownership are set by Kwaravend only';
  end if;
  return new;
end
$$;

-- --------------------------------------------------- 4/5. privacy read leaks
drop policy if exists "service role reads funnel events" on public.onboarding_funnel_events;
drop policy if exists "follows public read" on public.store_follows;

-- ------------------------------------------ 6. reviewer phones stay private
revoke select on public.store_ratings from anon, authenticated;
grant select (id, store_id, order_id, booking_id, stars, comment, created_at)
  on public.store_ratings to anon, authenticated;

-- -------------------------------------------- 7. no bucket-wide object listing
drop policy if exists "media public read" on storage.objects;
create policy "media owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'store-media' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (auth.uid())::text);

-- ---------------------------------------- 8. private bucket for digital goods
insert into storage.buckets (id, name, public, file_size_limit)
values ('digital-goods', 'digital-goods', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
-- No policies on purpose: only the service role (upload route after an
-- ownership check, download route after a one-time token) touches it.

-- ------------------------------------------- 9. POS staff change stock only
create or replace function public.guard_listing_staff_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if exists (select 1 from public.stores s where s.id = old.store_id and s.owner_id = auth.uid()) then
    return new;
  end if;
  if (to_jsonb(new) - 'stock' - 'updated_at') is distinct from (to_jsonb(old) - 'stock' - 'updated_at') then
    raise exception 'Staff can change stock only';
  end if;
  return new;
end
$$;
revoke all on function public.guard_listing_staff_update() from public, anon, authenticated;

drop trigger if exists trg_guard_listing_staff on public.listings;
create trigger trg_guard_listing_staff
  before update on public.listings
  for each row execute function public.guard_listing_staff_update();

-- ------------------------------------------------------------- 10. cleanup
drop function if exists public.mig_probe();
