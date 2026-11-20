-- Labelled example stores (REDESIGN: "demo stays labelled Example store /
-- Sample data"). Example stores are shown with that label, cannot take real
-- orders, and can be hidden everywhere with NEXT_PUBLIC_FLAG_EXAMPLE_STORES=off.
-- Additive and non-destructive: every existing store stays a real store.

alter table public.stores
  add column if not exists is_example boolean not null default false;

comment on column public.stores.is_example is
  'Sample-data store for demos. Labelled in the UI; orders are rejected server-side.';

create index if not exists idx_stores_is_example on public.stores(is_example) where is_example;
