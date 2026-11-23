-- Three storefront designs only Emirates Plus stores can publish: royale,
-- skyline and atelier (packages/shared/src/templates.ts, tier 'plus').
-- This only widens the allowed layout names; which plan may use which design
-- is checked by /api/settings when saving and by allowedLayout() when the
-- store page renders (a Free or Business store falls back to Modern).

alter table public.store_themes
  drop constraint if exists store_themes_layout_check;

alter table public.store_themes
  add constraint store_themes_layout_check check (layout in (
    'modern', 'classic', 'bold', 'minimal', 'boutique', 'merchant', 'luxury',
    'playful', 'sunset', 'marketplace', 'editorial', 'neon', 'pastel', 'monochrome',
    'showcase', 'festival', 'artisan', 'executive', 'aurora', 'corner',
    'royale', 'skyline', 'atelier'
  ));
