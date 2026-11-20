-- Anonymous map-page analytics (REDESIGN 6.4 "track events"). No location,
-- no person, no IP: only which control was used and, for store actions, which
-- store. Kept separate from store_events so map taps never inflate a store's
-- own view counts. Readable by the service role only (owner dashboards).

create table if not exists public.map_events (
  id bigint generated always as identity primary key,
  event text not null check (event in (
    'map_opened', 'pin_tapped', 'story_viewed', 'heat_toggled',
    'store_directions_clicked', 'store_order_clicked'
  )),
  store_id uuid references public.stores(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists map_events_created_idx on public.map_events (created_at);
create index if not exists map_events_store_idx on public.map_events (store_id, created_at) where store_id is not null;

alter table public.map_events enable row level security;
-- Inserts go through /api/map/event (service role, rate-limited); no public policies.
