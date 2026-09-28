-- 4 more layout templates (artisan, executive, aurora, corner) → 20 total.
alter table store_themes
  drop constraint if exists store_themes_layout_check;

alter table store_themes
  add constraint store_themes_layout_check check (layout in ('modern','classic','bold','minimal','boutique','merchant','luxury','playful','sunset','marketplace','editorial','neon','pastel','monochrome','showcase','festival','artisan','executive','aurora','corner'));
