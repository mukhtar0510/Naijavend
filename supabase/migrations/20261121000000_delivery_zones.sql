-- Landmark delivery zones + zone-limited discount codes (owner request, 21 Nov 2026).
-- Additive and non-destructive.
--   * Zone fees live in stores.delivery_options.zones (jsonb, no schema change).
--   * orders.delivery_zone records which landmark an order is delivered to
--     (delivery_method = 'zone').
--   * discount_codes.zone_id limits a code to one zone; null = any order.

alter table public.orders
  add column if not exists delivery_zone text not null default '';

alter table public.discount_codes
  add column if not exists zone_id text;

comment on column public.orders.delivery_zone is
  'Landmark id (storefront src/lib/landmarks.ts) when delivery_method = ''zone''; empty otherwise.';
comment on column public.discount_codes.zone_id is
  'Landmark id this code is limited to (e.g. unilorin); null = valid for any order.';
