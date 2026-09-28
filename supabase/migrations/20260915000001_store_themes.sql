-- Store appearance themes: accent colours, fonts, layout, hero style and image URLs.
-- One row per store; reads are public (store sites render them), writes are owner-only
-- via the stores.owner_id relationship.
create table if not exists public.store_themes (
  store_id uuid primary key references public.stores(id) on delete cascade,
  accent_color text not null default '#1D4ED8' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_soft text not null default '#3B82F6' check (accent_soft ~ '^#[0-9a-fA-F]{6}$'),
  accent_text text not null default '#FFFFFF' check (accent_text ~ '^#[0-9a-fA-F]{6}$'),
  font_heading text not null default 'Sora',
  font_body text not null default 'Inter',
  layout text not null default 'modern' check (layout in ('modern','classic','bold')),
  hero_style text not null default 'gradient' check (hero_style in ('gradient','image','solid')),
  banner_url text,
  favicon_url text,
  logo_url text,
  subheader_url text,
  background_color text not null default '#FFFFFF' check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz not null default now()
);

alter table public.store_themes enable row level security;

drop policy if exists "themes public read" on public.store_themes;
create policy "themes public read" on public.store_themes
  for select to anon, authenticated using (true);

drop policy if exists "themes owner write" on public.store_themes;
create policy "themes owner write" on public.store_themes
  for all to authenticated using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );

grant select on public.store_themes to anon, authenticated;
grant insert, update, delete on public.store_themes to authenticated;

-- Every existing store starts with the Sokoo defaults.
insert into public.store_themes (store_id)
select id from public.stores
on conflict (store_id) do nothing;
