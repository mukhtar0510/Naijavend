-- Site-wide background customization for store sites: a seller-uploaded
-- background photo/pattern (cover or tile), a readability overlay for busy
-- photos, curated gradient presets, and a page content width. All nullable —
-- null keeps the existing flat background_color behaviour, so no backfill and
-- no risk to live stores.

alter table public.store_themes
  add column if not exists background_image_url text,
  add column if not exists background_image_style text
    check (background_image_style is null or background_image_style in ('cover', 'tile')),
  add column if not exists background_overlay text
    check (background_overlay is null or background_overlay in ('none', 'dim', 'dark')),
  add column if not exists background_gradient text
    check (background_gradient is null or background_gradient in (
      'sunset', 'ocean', 'mint', 'lavender', 'rosewater', 'gold', 'charcoal', 'plum'
    )),
  add column if not exists content_width text
    check (content_width is null or content_width in ('narrow', 'normal', 'wide'));
