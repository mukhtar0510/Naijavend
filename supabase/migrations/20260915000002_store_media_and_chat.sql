-- store-media bucket: public listing images; sellers upload into their own folder.
insert into storage.buckets (id, name, public)
values ('store-media', 'store-media', true)
on conflict (id) do nothing;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'store-media');

drop policy if exists "media authenticated upload" on storage.objects;
create policy "media authenticated upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'store-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media owner update" on storage.objects;
create policy "media owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'store-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media owner delete" on storage.objects;
create policy "media owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'store-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- In-app chat between a store and its customers.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  sender text not null check (sender in ('customer','seller')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on public.chat_messages (store_id, customer_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "chat seller all" on public.chat_messages;
create policy "chat seller all" on public.chat_messages
  for all to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

drop policy if exists "chat customer read" on public.chat_messages;
create policy "chat customer read" on public.chat_messages
  for select to authenticated using (customer_id = auth.uid());

drop policy if exists "chat customer insert" on public.chat_messages;
create policy "chat customer insert" on public.chat_messages
  for insert to authenticated
  with check (customer_id = auth.uid() and sender = 'customer');

grant select, insert on public.chat_messages to authenticated;
