-- POS + staff for tier-2 (growth plan) sellers.
-- Staff are separate Supabase auth users linked to the owner's store with
-- limited roles; RLS lets them see only their store's operational rows.

create table if not exists public.store_staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'cashier' check (role in ('cashier', 'manager')),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.store_staff enable row level security;

-- Staff see their own store's staff rows; owners manage their store's staff.
create policy "staff_read_own_store" on public.store_staff
  for select using (
    store_id in (select store_id from public.store_staff where user_id = auth.uid())
    or exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );
create policy "owner_manage_staff" on public.store_staff
  for all using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );

-- Orders created via POS carry who charged them.
alter table public.orders
  add column if not exists pos_staff_id uuid references public.store_staff(id) on delete set null,
  add column if not exists channel text not null default 'online';

create index if not exists orders_store_channel_idx on public.orders (store_id, channel);

-- Staff can read their store's orders and order items (POS receipts, order
-- history). Complements orders_pos_insert / order_items_pos_insert.
create policy "orders_staff_read" on public.orders
  for select using (
    exists (
      select 1 from public.store_staff st
      where st.store_id = orders.store_id
        and st.user_id = auth.uid()
        and st.active
    )
  );

create policy "order_items_staff_read" on public.order_items
  for select using (
    exists (
      select 1
      from public.orders o
      join public.store_staff st
        on st.store_id = o.store_id and st.user_id = auth.uid() and st.active
      where o.id = order_items.order_id
    )
  );
