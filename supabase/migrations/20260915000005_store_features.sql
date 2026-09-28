-- Proper-store features: business hours, announcement bar, delivery & pickup info.
alter table public.stores
  add column if not exists business_hours jsonb,
  add column if not exists announcement text,
  add column if not exists delivery_info text;

-- business_hours shape (nullable = feature off):
-- { "mon": ["09:00", "18:00"], ..., "sun": null }  — null day or null array = closed.
comment on column public.stores.business_hours is 'Per-day open/close times, e.g. {"mon":["09:00","18:00"]}; null day = closed.';
