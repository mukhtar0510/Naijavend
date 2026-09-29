-- Atomic stock decrement for order placement. The old read-modify-write in
-- create-order (SELECT stock, then UPDATE stock = stock - wanted) allowed two
-- concurrent buyers to pass the stock check and oversell. This RPC checks and
-- decrements in one statement; it raises when there isn't enough stock so the
-- route can surface a clean 422 and the whole order write aborts.

create or replace function public.decrement_listing_stock(p_listing_id uuid, p_quantity int)
returns void
language plpgsql
as $$
declare
  v_remaining int;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  update public.listings
    set stock = stock - p_quantity
    where id = p_listing_id
      and stock is not null
      and stock >= p_quantity
    returning stock into v_remaining;

  if not found then
    -- Either the listing has no stock tracking (stock is null — fine) or there
    -- isn't enough left. Distinguish so the caller doesn't mis-block untracked items.
    select stock into v_remaining from public.listings where id = p_listing_id;
    if v_remaining is null then
      return; -- untracked stock: nothing to decrement
    end if;
    raise exception 'INSUFFICIENT_STOCK: only % left of listing %', v_remaining, p_listing_id;
  end if;
end $$;
