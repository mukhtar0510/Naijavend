-- SUPERSEDED — do not restore the original body.
--
-- This migration tried to create public.create_order_atomic but the function
-- body was not valid PL/pgSQL:
--   * `foreach p_listing_ids as idx loop` is not Postgres syntax
--     (FOREACH requires `FOREACH x IN ARRAY arr`), and
--   * it declared variables after executable statements inside the loop body.
--
-- Postgres rejected the whole statement, so the RPC never existed in any
-- environment and every checkout / POS charge that reached it failed.
--
-- The working function is created by
--   20261118100000_create_order_atomic_fix.sql
-- which also adds the customer_id, delivery_fee_kobo and discount_kobo fields
-- the checkout route needs.
--
-- This file is kept (rather than deleted) so migration history stays linear; it
-- is intentionally a no-op.

select 1;
