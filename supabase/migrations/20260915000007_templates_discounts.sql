-- Storefront templates + Shopify-style merchandising features.
-- 1) Three new structural site templates (beyond modern/classic/bold).
alter table public.store_themes drop constraint if exists store_themes_layout_check;
alter table public.store_themes
  add constraint store_themes_layout_check
  check (layout in ('modern','classic','bold','minimal','boutique','merchant'));

-- 2) Sale pricing + stock tracking on listings (Shopify-style compare-at & inventory).
alter table public.listings
  add column if not exists compare_at_kobo integer check (compare_at_kobo is null or compare_at_kobo >= 0);
alter table public.listings
  add column if not exists stock integer check (stock is null or stock >= 0);

-- 3) Discount codes per store (percentage off, active flag, usage cap).
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  percent_off integer not null check (percent_off between 1 and 90),
  active boolean not null default true,
  usage_count integer not null default 0,
  max_uses integer check (max_uses is null or max_uses > 0),
  created_at timestamptz not null default now(),
  unique (store_id, code)
);
alter table public.discount_codes enable row level security;

create policy "stores_read_own_discount_codes"
  on public.discount_codes for select
  using (auth.uid() = (select owner_id from public.stores where stores.id = store_id));
create policy "stores_write_own_discount_codes"
  on public.discount_codes for insert
  with check (auth.uid() = (select owner_id from public.stores where stores.id = store_id));
create policy "stores_update_own_discount_codes"
  on public.discount_codes for update
  using (auth.uid() = (select owner_id from public.stores where stores.id = store_id));
create policy "stores_delete_own_discount_codes"
  on public.discount_codes for delete
  using (auth.uid() = (select owner_id from public.stores where stores.id = store_id));

-- 4) Orders record the applied promo for checkout display and analytics.
alter table public.orders
  add column if not exists discount_code text;
alter table public.orders
  add column if not exists discount_kobo integer not null default 0 check (discount_kobo >= 0);

-- 5) Trending view gains the sale price for badge rendering.
drop view if exists public.trending_products;
create view public.trending_products as
select
  l.id,
  l.title,
  l.price_kobo,
  l.compare_at_kobo,
  l.type,
  l.image_urls,
  s.name as store_name,
  s.slug as store_slug,
  coalesce(sum(case when o.status in ('paid','fulfilled') then oi.quantity else 0 end), 0) as order_count,
  max(case when o.status in ('paid','fulfilled') then o.created_at end) as last_ordered_at
from public.listings l
join public.stores s on s.id = l.store_id
left join public.order_items oi on oi.listing_id = l.id
left join public.orders o on o.id = oi.order_id
group by l.id, s.name, s.slug;

grant select on public.trending_products to anon, authenticated;
