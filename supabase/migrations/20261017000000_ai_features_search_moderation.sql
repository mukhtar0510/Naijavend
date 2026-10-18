-- AI feature set v2 + trust/safety + smart-search backing tables.
--
-- Three groups of changes:
--   1. ai_usage_log: the feature CHECK only lists the original six features, so
--      every new AI surface would be silently dropped. Widened, idempotent
--      (same shape as 20261004 which has run in production).
--   2. listings gains a product-level `category` and searchable `tags`, plus a
--      moderation_flags table giving fraud signals one home (chat, reviews,
--      listings, stores). RLS is enabled with NO policies, so only the
--      service-role path (routes/staff) can read or write it.
--   3. pgvector: embedding columns and nearest-neighbour RPCs for semantic
--      search. This block is EXCEPTION-guarded — projects without the vector
--      extension still get migrations 1-2, and semantic ranking simply stays
--      off (search falls back to structured keyword/category filters).

-- ---------------------------------------------------------------------------
-- 1. ai_usage_log feature CHECK
-- ---------------------------------------------------------------------------
alter table public.ai_usage_log drop constraint if exists ai_usage_log_feature_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_feature_check
  check (feature in (
    'store_setup',
    'listing_description',
    'style_store',
    'assistant_chat',
    'assistant_action',
    'social_post',
    'image_gen',
    -- added with the marketplace AI feature set:
    'listing_draft',
    'suggest_reply',
    'translation',
    'weekly_insight',
    'moderation'
  ));

-- ---------------------------------------------------------------------------
-- 2. smart search columns + moderation flags
-- ---------------------------------------------------------------------------
alter table public.listings add column if not exists category text not null default 'general';
alter table public.listings add column if not exists tags jsonb not null default '[]'::jsonb;

create index if not exists idx_listings_category on public.listings(category);
create index if not exists idx_listings_tags on public.listings using gin (tags jsonb_path_ops);

-- One row per content signal worth a human look. Nothing is auto-removed:
-- flags are evidence for review, not a verdict.
create table if not exists public.moderation_flags (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  kind text not null check (kind in ('chat', 'review', 'listing', 'store')),
  -- chat_messages.id / store_ratings.id / listings.id / stores.id — deliberately
  -- not a FK: these live in four different tables and a cascading delete should
  -- not erase the audit trail of why something was flagged.
  ref_id uuid,
  labels jsonb not null default '[]'::jsonb,
  excerpt text not null default '',
  source text not null default 'rules',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_moderation_flags_store on public.moderation_flags(store_id, created_at desc);
create index if not exists idx_moderation_flags_open on public.moderation_flags(status, created_at desc) where status = 'open';

alter table public.moderation_flags enable row level security;
comment on table public.moderation_flags is
  'Trust & safety flags from content rules and the moderation model. Service-role only; buyers and sellers never read this table directly.';

-- ---------------------------------------------------------------------------
-- 3. pgvector embeddings (guarded: skip cleanly where the extension is absent)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists vector;

    alter table public.listings add column if not exists embedding vector(768);
    alter table public.stores add column if not exists embedding vector(768);
    create index if not exists idx_listings_embedding on public.listings
      using hnsw (embedding vector_cosine_ops);

    -- Nearest-neighbour search over catalogue text. Only rows that have been
    -- embedded participate; the app decides which query vector to send.
    -- NOTE: the inner function bodies use the $fn$ delimiter, never the
    -- outer DO delimiter — repeating the outer delimiter inside the block
    -- closes the DO body early and the whole migration fails to parse.
    create or replace function public.match_listings(
      query_embedding vector(768),
      p_limit integer default 12
    )
    returns table (id uuid, title text, price_kobo bigint, store_id uuid, similarity double precision)
    language sql stable as $fn$
      select l.id, l.title, l.price_kobo, l.store_id,
             1 - (l.embedding <=> query_embedding) as similarity
      from public.listings l
      where l.embedding is not null
      order by l.embedding <=> query_embedding
      limit least(coalesce(p_limit, 12), 50);
    $fn$;

    create or replace function public.match_stores(
      query_embedding vector(768),
      p_limit integer default 8
    )
    returns table (id uuid, name text, slug text, similarity double precision)
    language sql stable as $fn$
      select s.id, s.name, s.slug,
             1 - (s.embedding <=> query_embedding) as similarity
      from public.stores s
      where s.embedding is not null
      order by s.embedding <=> query_embedding
      limit least(coalesce(p_limit, 8), 30);
    $fn$;

    execute 'grant execute on function public.match_listings(vector, integer) to anon, authenticated';
    execute 'grant execute on function public.match_stores(vector, integer) to anon, authenticated';
  exception when others then
    raise notice 'pgvector unavailable — semantic search stays disabled: %', sqlerrm;
  end;
end $$;