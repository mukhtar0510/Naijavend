-- Security and performance audit (24 Nov 2026). See docs/SECURITY_PERF_AUDIT_2026-11-24.md.
--
-- Security
--   1. Orders: a seller's own token could write `orders` and `order_items`
--      directly through the API (policy orders_owner_all + full column grants):
--      raise a buyer's total after checkout, mark payment_status paid without
--      the confirm function, or insert fake "paid" orders that unlock verified
--      reviews. Same pattern as guard_store_plan: direct writes from the
--      `anon`/`authenticated` roles may only change status (the transition
--      trigger still decides which moves are allowed). Checkout, POS, payment
--      confirmation and receipts go through SECURITY DEFINER functions or the
--      service role and are unaffected.
--   2. Cancelling an order now puts its stock back (it never did).
--   3. confirm_order_payment refuses cancelled and refunded orders.
--   4. trending_products ran with its creator's rights (linter ERROR
--      security_definer_view) and exposed order counts to anyone. It now runs
--      as the caller and only the server (service role) reads it.
-- Performance
--   5. RLS policies call auth.uid() once per statement instead of once per row
--      (linter auth_rls_initplan, 59 policies). Same logic, rewritten in place.
--   6. Indexes for 17 foreign keys without one.

-- ------------------------------------------------------------------ 1. orders

create or replace function public.guard_order_direct_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Only direct API writes are limited. SECURITY DEFINER functions run as their
  -- owner and the server uses service_role, so current_user is neither of these.
  if current_user not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    raise exception 'Orders are created by checkout or the POS only';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Orders cannot be deleted';
  end if;
  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Only the order status can be changed here';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_order_direct_write on public.orders;
create trigger trg_guard_order_direct_write
  before insert or update or delete on public.orders
  for each row execute function public.guard_order_direct_write();

create or replace function public.guard_order_items_direct_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;
  raise exception 'Order lines are written by checkout or the POS only';
end $$;

drop trigger if exists trg_guard_order_items_direct_write on public.order_items;
create trigger trg_guard_order_items_direct_write
  before insert or update or delete on public.order_items
  for each row execute function public.guard_order_items_direct_write();

-- The POS insert policies are no longer used (create_pos_order is a function).
drop policy if exists orders_pos_insert on public.orders;
drop policy if exists order_items_pos_insert on public.order_items;
revoke insert, update, delete, truncate on public.orders, public.order_items from anon;

-- ------------------------------------------------------------------ 2. restock

create or replace function public.restock_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled' and old.status in ('pending', 'paid') then
    update public.listings l
       set stock = l.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id
       and oi.listing_id = l.id
       and l.stock is not null;
  end if;
  return null;
end $$;

revoke all on function public.restock_cancelled_order() from public, anon, authenticated;

drop trigger if exists trg_restock_cancelled_order on public.orders;
create trigger trg_restock_cancelled_order
  after update of status on public.orders
  for each row execute function public.restock_cancelled_order();

-- ------------------------------------------------------------------ 3. confirm

create or replace function public.confirm_order_payment(p_order_id uuid, p_method text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
  v_owner uuid;
  v_status text;
begin
  select store_id, status into v_store, v_status from public.orders where id = p_order_id;
  if v_store is null then
    raise exception 'order not found';
  end if;

  select owner_id into v_owner from public.stores where id = v_store;
  if auth.uid() is null or v_owner is distinct from auth.uid() then
    raise exception 'not your order';
  end if;
  if v_status in ('cancelled', 'refunded') then
    raise exception 'order is %', v_status;
  end if;

  update public.orders
  set payment_status = 'paid',
      payment_confirmed_at = coalesce(payment_confirmed_at, now()),
      payment_method = coalesce(nullif(p_method, ''), payment_method),
      status = case when status = 'pending' then 'paid' else status end,
      updated_at = now()
  where id = p_order_id;
end $$;

revoke all on function public.confirm_order_payment(uuid, text) from public, anon;
grant execute on function public.confirm_order_payment(uuid, text) to authenticated;

-- ------------------------------------------------------------------ 4. view

alter view public.trending_products set (security_invoker = true);
revoke select on public.trending_products from anon, authenticated;
grant select on public.trending_products to service_role;

-- ------------------------------------------------------------------ 5. RLS initplan

do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'auth\.(uid|jwt|role)\(\)' or coalesce(with_check, '') ~ 'auth\.(uid|jwt|role)\(\)')
  loop
    v_using := case when r.qual is null then null
                    else regexp_replace(r.qual, '(?<!select )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'gi') end;
    v_check := case when r.with_check is null then null
                    else regexp_replace(r.with_check, '(?<!select )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'gi') end;
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_using is not null then
      v_sql := v_sql || format(' using (%s)', v_using);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;
    execute v_sql;
  end loop;
end $$;

-- ------------------------------------------------------------------ 6. FK indexes

create index if not exists ai_usage_log_user_id_idx on public.ai_usage_log (user_id);
create index if not exists alerts_listing_id_idx on public.alerts (listing_id);
create index if not exists alerts_store_id_idx on public.alerts (store_id);
create index if not exists chat_messages_customer_id_idx on public.chat_messages (customer_id);
create index if not exists chat_read_state_user_id_idx on public.chat_read_state (user_id);
create index if not exists deliveries_rider_id_idx on public.deliveries (rider_id);
create index if not exists digital_deliveries_listing_id_idx on public.digital_deliveries (listing_id);
create index if not exists digital_deliveries_store_id_idx on public.digital_deliveries (store_id);
create index if not exists disputes_customer_id_idx on public.disputes (customer_id);
create index if not exists orders_pos_staff_id_idx on public.orders (pos_staff_id);
create index if not exists referrals_referred_idx on public.referrals (referred);
create index if not exists rider_requests_delivery_id_idx on public.rider_requests (delivery_id);
create index if not exists saved_stores_store_id_idx on public.saved_stores (store_id);
create index if not exists store_customer_notes_updated_by_idx on public.store_customer_notes (updated_by);
create index if not exists store_reports_reporter_id_idx on public.store_reports (reporter_id);
create index if not exists store_staff_created_by_idx on public.store_staff (created_by);
create index if not exists store_staff_store_id_idx on public.store_staff (store_id);
