-- Repair ai_usage_log so AI usage is actually recorded.
--
-- Three defects shipped together:
--   1. The feature CHECK excluded 'style_store' (and everything after it), so
--      the style-store route's inserts were rejected.
--   2. The route writes `input` and `provider` columns that never existed.
--   3. There was no INSERT policy, so every insert from the seller-scoped
--      client (the only way routes write this table) was silently dropped.
-- Net effect: the table has been empty since launch. This migration is
-- idempotent (if exists / drop-if-exists guards) so it can be re-run safely.

-- 1. Widen the feature CHECK to cover every AI feature past and planned.
alter table public.ai_usage_log drop constraint if exists ai_usage_log_feature_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_feature_check
  check (feature in (
    'store_setup',
    'listing_description',
    'style_store',
    'assistant_chat',
    'assistant_action',
    'social_post'
  ));

-- 2. Columns the style-store route (and future assistant work) already writes.
alter table public.ai_usage_log add column if not exists provider text;
alter table public.ai_usage_log add column if not exists input text;
alter table public.ai_usage_log add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.ai_usage_log add column if not exists latency_ms integer;
alter table public.ai_usage_log add column if not exists error text;

-- 3. The missing write path: the seller-scoped client (anon key + user JWT)
-- inserts usage rows for its own store. Without this policy every insert was
-- silently dropped by RLS.
drop policy if exists ai_usage_owner_insert on public.ai_usage_log;
create policy ai_usage_owner_insert on public.ai_usage_log
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.stores s
      where s.id = store_id
        and s.owner_id = auth.uid()
    )
  );

-- Keep the existing read policy for the owner; nothing to change there.
