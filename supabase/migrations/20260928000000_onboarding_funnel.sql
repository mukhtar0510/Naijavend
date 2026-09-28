-- Onboarding funnel analytics: one row per tracked seller action during
-- store setup. Lets the admin console show where sellers drop off
-- (step 1 → 2 → 3 → published) and which quick-add chips get used.
create table if not exists public.onboarding_funnel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event in ('step_view', 'step_complete', 'chip_add', 'preview_shown', 'abandon')),
  step int check (step between 1 and 3),
  label text,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_funnel_events_user_idx on public.onboarding_funnel_events (user_id, created_at);
create index if not exists onboarding_funnel_events_event_idx on public.onboarding_funnel_events (event, created_at);

alter table public.onboarding_funnel_events enable row level security;

-- Sellers log their own funnel events only; the admin console reads via the
-- service role (bypasses RLS), so no read policy for authenticated users.
create policy "sellers insert own funnel events"
  on public.onboarding_funnel_events for insert to authenticated
  with check (auth.uid() = user_id);

create policy "service role reads funnel events"
  on public.onboarding_funnel_events for select to service_role using (true);
