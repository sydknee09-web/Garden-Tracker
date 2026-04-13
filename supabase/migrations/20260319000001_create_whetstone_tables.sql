-- Phase 8: Whetstone habit definitions + daily ritual completions.
-- Uses app column names already wired in Flutter:
-- whetstone_items.title/is_active/order_index
-- whetstone_completions.completed_date/completed_at

create extension if not exists "uuid-ossp";

create table if not exists public.whetstone_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  order_index int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.whetstone_completions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.whetstone_items(id) on delete cascade,
  completed_date date not null default current_date,
  completed_at timestamptz not null default now(),
  unique (user_id, item_id, completed_date)
);

create index if not exists whetstone_items_user_active_order_idx
  on public.whetstone_items(user_id, is_active, order_index);

create index if not exists whetstone_completions_user_date_idx
  on public.whetstone_completions(user_id, completed_date);

alter table public.whetstone_items enable row level security;
alter table public.whetstone_completions enable row level security;

drop policy if exists "whetstone_items_select_own" on public.whetstone_items;
create policy "whetstone_items_select_own"
  on public.whetstone_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "whetstone_items_insert_own" on public.whetstone_items;
create policy "whetstone_items_insert_own"
  on public.whetstone_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "whetstone_items_update_own" on public.whetstone_items;
create policy "whetstone_items_update_own"
  on public.whetstone_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "whetstone_items_delete_own" on public.whetstone_items;
create policy "whetstone_items_delete_own"
  on public.whetstone_items
  for delete
  using (auth.uid() = user_id);

drop policy if exists "whetstone_completions_select_own" on public.whetstone_completions;
create policy "whetstone_completions_select_own"
  on public.whetstone_completions
  for select
  using (auth.uid() = user_id);

drop policy if exists "whetstone_completions_insert_own" on public.whetstone_completions;
create policy "whetstone_completions_insert_own"
  on public.whetstone_completions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "whetstone_completions_update_own" on public.whetstone_completions;
create policy "whetstone_completions_update_own"
  on public.whetstone_completions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "whetstone_completions_delete_own" on public.whetstone_completions;
create policy "whetstone_completions_delete_own"
  on public.whetstone_completions
  for delete
  using (auth.uid() = user_id);
