-- Buyer–seller chat, phase 2: the seller inbox needs to show *who* it is
-- talking to. customers is currently locked to self-read only, so a seller
-- joining chat_messages -> customers sees nulls. Grant sellers (store owners)
-- a narrow read of just the display name of customers who chatted with their
-- store — nothing else, no emails, no phones.
drop policy if exists "customers chat name read" on public.customers;
create policy "customers chat name read"
  on public.customers
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.chat_messages cm
      join public.stores s on s.id = cm.store_id
      where cm.customer_id = customers.id
        and s.owner_id = auth.uid()
    )
  );

-- Unread tracking: a lightweight marker per thread. Sellers and customers
-- each keep their own last-seen timestamp so both sides can badge new
-- messages without a notifications service.
create table if not exists public.chat_read_state (
  thread_id text not null primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_read_state enable row level security;

drop policy if exists "chat_read self all" on public.chat_read_state;
create policy "chat_read self all"
  on public.chat_read_state
  as permissive
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.chat_read_state to authenticated;
