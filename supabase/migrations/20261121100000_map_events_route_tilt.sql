-- Allow two more map events (non-destructive: the allowed list only grows).
--   tilt_toggled : the Tilt view button (was being rejected)
--   route_shown  : the buyer asked for the way to a store on /map
alter table public.map_events drop constraint if exists map_events_event_check;
alter table public.map_events add constraint map_events_event_check check (event in (
  'map_opened', 'pin_tapped', 'story_viewed', 'heat_toggled',
  'store_directions_clicked', 'store_order_clicked',
  'tilt_toggled', 'route_shown'
));
