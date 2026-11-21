-- Checkout delivery details (BUILD.md T05/T08; owner, 21 Nov 2026: "make the
-- map part of the checkout"). Non-destructive: new columns only.
--   delivery_area     Ilorin area id from lib/ilorin.ts (required for delivery)
--   delivery_address  street / house description typed by the buyer
--   delivery_landmark "how to find you" note (landmarks matter in Ilorin)
--   delivery_note     note to the seller
--   drop_lat/drop_lng optional pin the buyer chose to share for THIS delivery
-- The pin is only ever written when the buyer drops it at checkout; it is
-- readable by the store's owner through the existing orders RLS.
alter table public.orders add column if not exists delivery_area text not null default '' check (char_length(delivery_area) <= 40);
alter table public.orders add column if not exists delivery_address text not null default '' check (char_length(delivery_address) <= 200);
alter table public.orders add column if not exists delivery_landmark text not null default '' check (char_length(delivery_landmark) <= 120);
alter table public.orders add column if not exists delivery_note text not null default '' check (char_length(delivery_note) <= 300);
alter table public.orders add column if not exists drop_lat double precision check (drop_lat is null or drop_lat between 8.33 and 8.66);
alter table public.orders add column if not exists drop_lng double precision check (drop_lng is null or drop_lng between 4.38 and 4.74);
