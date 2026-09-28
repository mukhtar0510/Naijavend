-- Listings: optional product video + storage guard.
-- video_url holds one https URL (store-media bucket) per listing.
-- The store-media bucket gets a 64 MB per-file cap so videos can't be
-- an unbounded storage-cost hole (images stay capped at 5 MB in the API).
alter table public.listings add column if not exists video_url text;

update storage.buckets
set file_size_limit = 67108864 -- 64 MB
where id = 'store-media' and file_size_limit is null;
