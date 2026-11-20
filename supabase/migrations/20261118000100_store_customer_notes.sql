-- T12: real CRM notes. The customer list itself is derived from orders (a
-- customer is anyone who ordered); this table persists the seller's private
-- notes against that phone number, per store.
--
-- Phone is the key because orders only carry name + phone. A proper customers
-- table with ids is the next step once buyers are required to sign in.

create table if not exists public.store_customer_notes (
  store_id uuid not null references public.stores(id) on delete cascade,
  phone text not null check (char_length(phone) between 5 and 32),
  note text not null check (char_length(note) <= 2000),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (store_id, phone)
);

comment on table public.store_customer_notes is
  'Seller-private notes about a buyer, keyed by the phone number used on their orders.';

alter table public.store_customer_notes enable row level security;

drop policy if exists "owners manage their customer notes" on public.store_customer_notes;
create policy "owners manage their customer notes"
  on public.store_customer_notes
  for all
  to authenticated
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_customer_notes.store_id
        and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stores s
      where s.id = store_customer_notes.store_id
        and s.owner_id = auth.uid()
    )
  );

create index if not exists store_customer_notes_store_idx
  on public.store_customer_notes (store_id, updated_at desc);
