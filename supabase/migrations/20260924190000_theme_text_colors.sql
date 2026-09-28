-- Store-site customization upgrades: per-site text colours + shape/style options.
alter table public.store_themes
  add column if not exists text_color text,
  add column if not exists heading_color text,
  add column if not exists muted_color text,
  add column if not exists button_shape text default 'rounded',
  add column if not exists card_style text default 'soft';

alter table public.store_themes
  drop constraint if exists store_themes_text_color_check,
  drop constraint if exists store_themes_heading_color_check,
  drop constraint if exists store_themes_muted_color_check,
  drop constraint if exists store_themes_button_shape_check,
  drop constraint if exists store_themes_card_style_check;

alter table public.store_themes
  add constraint store_themes_text_color_check check (text_color is null or text_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint store_themes_heading_color_check check (heading_color is null or heading_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint store_themes_muted_color_check check (muted_color is null or muted_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint store_themes_button_shape_check check (button_shape in ('pill','rounded','square')),
  add constraint store_themes_card_style_check check (card_style in ('soft','outline','shadow'));
