-- Applied directly to the live database on 21 Nov 2026 at 22:46 (outside this
-- repo). Copied here verbatim on 22 Nov 2026 so the local migration history
-- matches the remote one. Do not edit: it has already run.
--
-- Security hardening (Supabase advisor): trigger functions can't be called
-- through the API; payment RPCs need a signed-in user; search_path pinned.
-- Checked against the app: guest receipt uploads use the service role
-- (/api/orders/proof) and confirm_order_payment is called by signed-in
-- sellers, so neither is affected.

-- 1. Trigger functions are run by the database, never called through the API.
revoke execute on function public.alert_booking_status_change() from public, anon, authenticated;
revoke execute on function public.alert_chat_message() from public, anon, authenticated;
revoke execute on function public.alert_dispute_update() from public, anon, authenticated;
revoke execute on function public.alert_followers_new_listing() from public, anon, authenticated;
revoke execute on function public.alert_order_status_change() from public, anon, authenticated;
revoke execute on function public.alert_price_drop() from public, anon, authenticated;
revoke execute on function public.mint_digital_deliveries() from public, anon, authenticated;

-- 2. These two check auth.uid() inside, so signed-out callers can never succeed. Keep signed-in access only.
revoke execute on function public.confirm_order_payment(uuid, text) from public, anon;
grant execute on function public.confirm_order_payment(uuid, text) to authenticated;
revoke execute on function public.attach_payment_proof(uuid, text) from public, anon;
grant execute on function public.attach_payment_proof(uuid, text) to authenticated;

-- 3. Pin the search path on the six functions that had none.
alter function public.guard_order_status_transition() set search_path = public, extensions, pg_temp;
alter function public.decrement_listing_stock(uuid, integer) set search_path = public, extensions, pg_temp;
alter function public.mig_probe() set search_path = public, extensions, pg_temp;
alter function public.match_listings(vector, integer) set search_path = public, extensions, pg_temp;
alter function public.match_stores(vector, integer) set search_path = public, extensions, pg_temp;
alter function public.set_store_location_position() set search_path = public, extensions, pg_temp;
