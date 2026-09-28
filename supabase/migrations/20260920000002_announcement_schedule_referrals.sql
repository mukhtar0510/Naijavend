-- Announcement scheduling + customer referrals.
alter table public.stores
  add column if not exists announcement_starts_at timestamptz,
  add column if not exists announcement_ends_at timestamptz;

-- Public code -> referrer mapping (no PII; codes are random).
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
drop policy if exists "codes are publicly readable" on public.referral_codes;
create policy "codes are publicly readable" on public.referral_codes for select using (true);
drop policy if exists "create own code" on public.referral_codes;
create policy "create own code" on public.referral_codes for insert with check (auth.uid() = user_id);

-- One row per successful referred signup.
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer uuid not null references auth.users(id) on delete cascade,
  referred uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (referrer, referred)
);
alter table public.referrals enable row level security;
drop policy if exists "read own referrals" on public.referrals;
create policy "read own referrals" on public.referrals for select using (auth.uid() = referrer or auth.uid() = referred);
drop policy if exists "insert own referred row" on public.referrals;
create policy "insert own referred row" on public.referrals for insert with check (auth.uid() = referred);
