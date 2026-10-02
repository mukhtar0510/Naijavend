-- Section-level colour overrides for store sites: the hero band, the
-- product-grid sections and the footer can each get their own background
-- colour, so a seller can run a dark hero over a light grid (the standard
-- Fourthwall/Shopify "section override" pattern). Nullable = theme default,
-- so no backfill and no risk to live stores.

alter table public.store_themes
  add column if not exists hero_bg_color text
    check (hero_bg_color is null or hero_bg_color ~* '^#[0-9a-fA-F]{6}$'),
  add column if not exists grid_bg_color text
    check (grid_bg_color is null or grid_bg_color ~* '^#[0-9a-fA-F]{6}$'),
  add column if not exists footer_bg_color text
    check (footer_bg_color is null or footer_bg_color ~* '^#[0-9a-fA-F]{6}$');
