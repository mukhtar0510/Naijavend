-- iDevTenancy — store rankings (intent: leaderboards overall + per category)
-- Bayesian average so a store with one 5★ doesn't outrank a store with 200 reviews at 4.8.
-- Implemented as a plain table maintained by triggers (simpler than a materialized view
-- refresh cycle and always fresh after writes).

create table public.store_rating_stats (
  store_id uuid primary key references public.stores(id) on delete cascade,
  review_count integer not null default 0,
  avg_stars numeric(3,2) not null default 0,
  -- Bayesian weighted average: (m * prior + sum(stars)) / (m + count), m = 5, prior = 3.5
  weighted_score numeric(6,3) not null default 0,
  overall_rank integer,
  category_rank integer,
  updated_at timestamptz not null default now()
);

alter table public.store_rating_stats enable row level security;
create policy stats_public_read on public.store_rating_stats for select using (true);

create index idx_stats_overall on public.store_rating_stats(weighted_score desc);
create index idx_stats_category on public.stores(category);
-- Category leaderboard join helper
create index idx_stats_store_category on public.store_rating_stats(store_id);

-- Recompute one store's stats from raw ratings.
create or replace function public.refresh_store_stats(p_store_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_sum bigint;
  v_category text;
begin
  select count(*), coalesce(sum(stars), 0) into v_count, v_sum
  from public.store_ratings where store_id = p_store_id;

  select category into v_category from public.stores where id = p_store_id;

  insert into public.store_rating_stats
    (store_id, review_count, avg_stars, weighted_score, updated_at)
  values (
    p_store_id,
    v_count,
    case when v_count = 0 then 0 else round(v_sum::numeric / v_count, 2) end,
    case when v_count = 0 then 0
         else round(((5 * 3.5) + v_sum) / (5 + v_count), 3) end,
    now()
  )
  on conflict (store_id) do update
    set review_count = excluded.review_count,
        avg_stars = excluded.avg_stars,
        weighted_score = excluded.weighted_score,
        updated_at = now();

  perform public.refresh_rankings();
end $$;

-- Recompute overall + per-category ranks from weighted scores.
create or replace function public.refresh_rankings()
returns void language plpgsql security definer set search_path = public as $$
begin
  with scored as (
    select
      st.store_id,
      row_number() over (order by st.weighted_score desc, st.review_count desc) as o_rank,
      row_number() over (
        partition by s.category
        order by st.weighted_score desc, st.review_count desc
      ) as c_rank
    from public.store_rating_stats st
    join public.stores s on s.id = st.store_id
  )
  update public.store_rating_stats st
  set overall_rank = scored.o_rank,
      category_rank = scored.c_rank
  from scored
  where st.store_id = scored.store_id;
end $$;

-- Keep stats fresh: any rating write triggers a refresh of that store.
create or replace function public.trg_refresh_stats_on_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_store uuid;
begin
  v_store := coalesce(new.store_id, old.store_id);
  perform public.refresh_store_stats(v_store);
  return null;
end $$;

create trigger trg_rating_stats_insert after insert on public.store_ratings
  for each row execute function public.trg_refresh_stats_on_rating();
create trigger trg_rating_stats_delete after delete on public.store_ratings
  for each row execute function public.trg_refresh_stats_on_rating();
create trigger trg_rating_stats_update after update of stars on public.store_ratings
  for each row execute function public.trg_refresh_stats_on_rating();

-- Seed stats rows for existing stores (idempotent).
create or replace function public.seed_store_stats()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.store_rating_stats (store_id)
  select id from public.stores
  on conflict (store_id) do nothing;
end $$;

-- Auto-create a stats row whenever a store is created.
create or replace function public.trg_seed_stats_on_store()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.store_rating_stats (store_id) values (new.id)
  on conflict (store_id) do nothing;
  return null;
end $$;

create trigger trg_store_stats_seed after insert on public.stores
  for each row execute function public.trg_seed_stats_on_store();
