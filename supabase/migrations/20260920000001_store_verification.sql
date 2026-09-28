-- Blue-tick verification for stores.
-- Rule: a store can apply once it has 30+ reviews averaging 4.0+ stars;
-- applying with the rule met flips verification_status to 'verified'.
alter table public.stores
  add column if not exists verification_status text not null default 'unverified' check (verification_status in ('unverified','verified')),
  add column if not exists verified_at timestamptz;
