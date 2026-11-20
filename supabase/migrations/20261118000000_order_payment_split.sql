-- T04: separate fulfilment from money.
--
-- Before this, orders.status carried both ("paid", "fulfilled"), so a seller
-- could not say "confirmed, awaiting bank transfer" and nothing recorded HOW the
-- money arrived. Now:
--   payment_status: unpaid | awaiting_confirmation | paid | refunded | failed
--   payment_method: '' | cash_on_delivery | bank_transfer | pay_on_pickup | other
-- No online payment provider is involved; a seller confirms money received.

alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists payment_method text not null default '';
alter table public.orders add column if not exists payment_proof_url text;
alter table public.orders add column if not exists payment_confirmed_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'awaiting_confirmation', 'paid', 'refunded', 'failed'));

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('', 'cash_on_delivery', 'bank_transfer', 'pay_on_pickup', 'other'));

-- Backfill from the legacy combined status so existing rows keep their meaning.
update public.orders
set payment_status = case
      when status in ('paid', 'fulfilled') then 'paid'
      when status = 'refunded' then 'refunded'
      else 'unpaid'
    end
where payment_status = 'unpaid'
  and status in ('paid', 'fulfilled', 'refunded');

-- Sellers may now move pending -> paid, but ONLY in the same write that records
-- the payment as received. Every other transition stays exactly as before.
create or replace function public.guard_order_status_transition()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null then
    return new; -- service role (order creation, payment webhook, refunds)
  end if;
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'pending' and new.status = 'cancelled' then
    return new;
  end if;
  if old.status = 'pending' and new.status = 'paid' and new.payment_status = 'paid' then
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

-- Seller-only confirmation of a manual payment (cash, transfer, pickup).
-- Owner check lives in the function so the client cannot forge a store id.
create or replace function public.confirm_order_payment(p_order_id uuid, p_method text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
  v_owner uuid;
begin
  select store_id into v_store from public.orders where id = p_order_id;
  if v_store is null then
    raise exception 'order not found';
  end if;

  select owner_id into v_owner from public.stores where id = v_store;
  if auth.uid() is null or v_owner is distinct from auth.uid() then
    raise exception 'not your order';
  end if;

  update public.orders
  set payment_status = 'paid',
      payment_confirmed_at = now(),
      payment_method = coalesce(nullif(p_method, ''), payment_method),
      status = case when status = 'pending' then 'paid' else status end,
      updated_at = now()
  where id = p_order_id;
end $$;

revoke all on function public.confirm_order_payment(uuid, text) from public;
grant execute on function public.confirm_order_payment(uuid, text) to authenticated;

-- Buyer attaches a transfer receipt. Security definer so a customer cannot be
-- granted broad UPDATE on orders (they could rewrite totals otherwise).
create or replace function public.attach_payment_proof(p_order_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_status text;
begin
  select customer_id, payment_status into v_customer, v_status
  from public.orders where id = p_order_id;

  if v_customer is null or v_customer is distinct from auth.uid() then
    raise exception 'not your order';
  end if;
  if v_status not in ('unpaid', 'awaiting_confirmation') then
    raise exception 'payment already recorded';
  end if;

  update public.orders
  set payment_proof_url = left(p_url, 500),
      payment_status = 'awaiting_confirmation',
      updated_at = now()
  where id = p_order_id;
end $$;

revoke all on function public.attach_payment_proof(uuid, text) from public;
grant execute on function public.attach_payment_proof(uuid, text) to authenticated;
