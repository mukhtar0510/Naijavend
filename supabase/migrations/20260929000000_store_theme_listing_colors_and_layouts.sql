-- Store theme: listing-card colour controls + border-radius toggle + 4 new layout templates.
alter table store_themes
  add column if not exists listing_color text,
  add column if not exists listing_bg_color text,
  add column if not exists card_radius text;

alter table store_themes
  drop constraint if exists store_themes_listing_color_check,
  drop constraint if exists store_themes_listing_bg_color_check,
  drop constraint if exists store_themes_card_radius_check,
  drop constraint if exists store_themes_layout_check;

alter table store_themes
  add constraint store_themes_listing_color_check check (listing_color is null or listing_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint store_themes_listing_bg_color_check check (listing_bg_color is null or listing_bg_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint store_themes_card_radius_check check (card_radius is null or card_radius in ('sharp', 'rounded')),
  add constraint store_themes_layout_check check (layout in ('modern','classic','bold','minimal','boutique','merchant','luxury','playful','sunset','marketplace'));
