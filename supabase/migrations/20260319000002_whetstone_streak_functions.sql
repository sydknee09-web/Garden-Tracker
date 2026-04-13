-- Phase 8.2: Grace-aware Whetstone streak RPCs (Option A freeze).
-- Uses 4:00 AM boundary and whetstone_completions.completed_date.

create or replace function public.get_whetstone_streak(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_streak integer := 0;
  v_current_date date;
  v_check_date date;
  v_completed boolean;
  v_grace_used boolean := false;
begin
  -- "Sanctuary Today": local 4:00 AM boundary at DB runtime timezone.
  v_current_date := (
    case
      when extract(hour from now()) < 4
      then (current_date - interval '1 day')
      else current_date
    end
  )::date;

  v_check_date := v_current_date;

  loop
    select exists (
      select 1
      from public.whetstone_completions wc
      where wc.user_id = p_user_id
        and wc.completed_date = v_check_date
    ) into v_completed;

    if v_completed then
      v_streak := v_streak + 1;
      v_grace_used := false;
    else
      if v_check_date = v_current_date then
        null; -- do not count "today not yet done" as an immediate miss
      elsif not v_grace_used then
        v_grace_used := true; -- one-day freeze
      else
        exit; -- two misses in a row => break
      end if;
    end if;

    v_check_date := (v_check_date - interval '1 day')::date;
    if v_streak > 1000 then
      exit;
    end if;
  end loop;

  return v_streak;
end;
$$;

create or replace function public.get_whetstone_grace_active(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_date date;
  v_has_today boolean;
  v_has_yesterday boolean;
begin
  v_current_date := (
    case
      when extract(hour from now()) < 4
      then (current_date - interval '1 day')
      else current_date
    end
  )::date;

  select exists (
    select 1
    from public.whetstone_completions wc
    where wc.user_id = p_user_id
      and wc.completed_date = v_current_date
  ) into v_has_today;

  if v_has_today then
    return false;
  end if;

  select exists (
    select 1
    from public.whetstone_completions wc
    where wc.user_id = p_user_id
      and wc.completed_date = (v_current_date - interval '1 day')::date
  ) into v_has_yesterday;

  return v_has_yesterday;
end;
$$;

grant execute on function public.get_whetstone_streak(uuid) to authenticated;
grant execute on function public.get_whetstone_grace_active(uuid) to authenticated;
