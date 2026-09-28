-- Superadmin: audit trail + ban blocklist. Both tables are service-role-only
-- (RLS denies everyone else); the admin API reads/writes them with the service key.

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_email text not null,
  action text not null,                -- ban | unban | delete | self_delete
  target_email text,
  target_user_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.banned_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  reason text,
  banned_at timestamptz not null default now()
);

-- No public policies: RLS is on by default for new tables in this project and
-- these must only ever be touched server-side with the service role key.

alter table public.admin_audit_log enable row level security;
alter table public.banned_users enable row level security;
