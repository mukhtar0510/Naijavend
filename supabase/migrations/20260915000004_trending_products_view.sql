-- Aggregate popularity view for the homepage "Trending products" section.
-- Exposes no customer data — only per-product paid-order counts.
-- security_invoker keeps the view subject to the caller's RLS on underlying tables.
create or replace view public.trending_products with (security_invoker = true) as
select
  l.id,
  l.title,
  l.price_kobo,
  l.type,
  l.image_urls,
  s.name as store_name,
  s.slug as store_slug,
  coalesce(sum(case when o.status in ('paid','fulfilled') then oi.quantity else 0 end), 0) as order_count
from public.listings l
join public.stores s on s.id = l.store_id
left join public.order_items oi on oi.listing_id = l.id
left join public.orders o on o.id = oi.order_id
where l.type = 'product'
group by l.id, l.title, l.price_kobo, l.type, l.image_urls, s.name, s.slug;

grant select on public.trending_products to anon, authenticated;
