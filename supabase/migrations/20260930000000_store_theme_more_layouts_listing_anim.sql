-- 6 new layout templates + listing-card surface style + hover animation.
alter table store_themes
  add column if not exists listing_style text,
  add column if not exists hover_anim text;

alter table store_themes
  drop constraint if exists store_themes_layout_check,
  drop constraint if exists store_themes_listing_style_check,
  drop constraint if exists store_themes_hover_anim_check;

alter table store_themes
  add constraint store_themes_layout_check check (layout in ('modern','classic','bold','minimal','boutique','merchant','luxury','playful','sunset','marketplace','editorial','neon','pastel','monochrome','showcase','festival')),
  add constraint store_themes_listing_style_check check (listing_style is null or listing_style in ('plain','gradient','glass','outlined','elevated')),
  add constraint store_themes_hover_anim_check check (hover_anim is null or hover_anim in ('none','lift','tilt','zoom','glow','wiggle'));
