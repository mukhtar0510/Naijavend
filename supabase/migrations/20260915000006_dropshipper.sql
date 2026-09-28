-- Dropshipper store type: a flag plus a free-text note about supplier base and
-- shipping times, rendered as a dedicated card on the store site and a tag on
-- marketplace cards. Nullable text; flag defaults false for existing stores.
alter table public.stores
  add column if not exists is_dropshipper boolean not null default false,
  add column if not exists dropship_info text;

-- RLS: stores policy already allows owners to update their own row — no change.
