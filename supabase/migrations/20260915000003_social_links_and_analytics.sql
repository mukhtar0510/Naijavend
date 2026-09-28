-- Seller social links + lightweight store analytics events.
alter table public.stores add column if not exists social_links jsonb not null default '{}'::jsonb;

create table if not exists public.store_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  event_type text not null check (event_type in ('view','listing_view','share','link_copy','chat_started')),
  path text,
  referrer text,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists store_events_store_idx on public.store_events (store_id, event_type, created_at);

alter table public.store_events enable row level security;

drop policy if exists "events public insert" on public.store_events;
create policy "events public insert" on public.store_events
  for insert to anon, authenticated with check (true);

drop policy if exists "events owner read" on public.store_events;
create policy "events owner read" on public.store_events
  for select to authenticated using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );

grant insert on public.store_events to anon, authenticated;
grant select on public.store_events to authenticated;
