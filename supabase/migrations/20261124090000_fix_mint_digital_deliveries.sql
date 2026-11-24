-- Critical fix (found 24 Nov 2026 in a rolled-back order test).
--
-- mint_digital_deliveries runs on every order update that moves status to
-- 'paid'. It called gen_random_bytes() with search_path = public, but pgcrypto
-- lives in the `extensions` schema, so the trigger raised
-- "function gen_random_bytes(integer) does not exist" and the whole update
-- failed. Result: confirm_order_payment (the seller's "payment received"
-- button) failed for every order, digital or not.
--
-- Same body; the function now names the schema and search_path includes it.

create or replace function public.mint_digital_deliveries()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_contact text;
begin
  if new.status <> 'paid' or old.status = 'paid' then
    return new; -- only the pending -> paid transition mints
  end if;

  -- We don't collect email; the buyer's phone doubles as the delivery contact.
  v_contact := new.customer_phone;

  insert into public.digital_deliveries (order_id, listing_id, store_id, buyer_email, download_token)
  select
    oi.order_id,
    oi.listing_id,
    new.store_id,
    v_contact,
    encode(extensions.gen_random_bytes(32), 'hex')  -- 64-hex-char one-time token
  from public.order_items oi
  join public.listings l on l.id = oi.listing_id
  where oi.order_id = new.id
    and l.type = 'digital'
    and l.digital_file_path is not null
  on conflict (order_id, listing_id) do nothing;

  return new;
end $$;
