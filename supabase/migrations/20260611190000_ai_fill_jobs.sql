-- AI Fill backgrounding: durable job rows so enrichment survives navigation and
-- the client can restore spinner/shimmer state + receive completion via realtime.
-- Additive + idempotent throughout (safe to rerun).

create table if not exists public.ai_fill_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plant_profile_id uuid not null references public.plant_profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'complete', 'failed')),
  -- Job mode: false = Fill Blanks (blank-only writes), true = Overwrite. The job must
  -- carry its request mode; result_summary below is for results only.
  overwrite boolean not null default false,
  enqueued_at timestamptz not null default now(),
  completed_at timestamptz,
  -- { fieldsFilled, notFound, enriched, error?, plantName } written at completion.
  result_summary jsonb
);

-- Active-set lookups (client initial fetch + reconciliation).
create index if not exists ai_fill_jobs_user_status_idx
  on public.ai_fill_jobs (user_id, status);

-- One active job per profile: the enqueue route catches the unique violation on a
-- race and returns the existing job instead of double-running the pipeline.
create unique index if not exists ai_fill_jobs_one_active_per_profile
  on public.ai_fill_jobs (plant_profile_id)
  where status in ('pending', 'running');

-- Sweeper cleanup scan (delete complete/failed older than 7 days).
create index if not exists ai_fill_jobs_completed_at_idx
  on public.ai_fill_jobs (completed_at)
  where status in ('complete', 'failed');

alter table public.ai_fill_jobs enable row level security;

-- Own-rows policies. Job rows are written server-side with the user-scoped client
-- (Bearer token), so insert/update need auth.uid() policies too. No delete policy:
-- cleanup is the sweeper's job (service role bypasses RLS).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_fill_jobs' and policyname = 'ai_fill_jobs_select_own') then
    create policy ai_fill_jobs_select_own on public.ai_fill_jobs for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_fill_jobs' and policyname = 'ai_fill_jobs_insert_own') then
    create policy ai_fill_jobs_insert_own on public.ai_fill_jobs for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_fill_jobs' and policyname = 'ai_fill_jobs_update_own') then
    create policy ai_fill_jobs_update_own on public.ai_fill_jobs for update using (auth.uid() = user_id);
  end if;
end $$;

-- Realtime: the client subscribes to postgres_changes on this table (filtered by
-- user_id, RLS-respected) for spinner/shimmer state + completion toasts.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ai_fill_jobs'
  ) then
    alter publication supabase_realtime add table public.ai_fill_jobs;
  end if;
end $$;
