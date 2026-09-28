-- Customer profile upgrades: avatars.
-- Name/phone were already editable under the customers_self_all RLS policy;
-- this adds the avatar_url column and a public 'avatars' storage bucket where
-- each signed-in customer may only write inside their own auth.uid() folder
-- (same folder-isolation pattern as the seller store-media bucket).
alter table public.customers add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');

drop policy if exists "avatars owner upload" on storage.objects;
create policy "avatars owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
