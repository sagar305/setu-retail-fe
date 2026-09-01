-- Chores that reschedule from when they were actually done, rather than from
-- a fixed calendar pattern. Cleaning the fridge four weeks early moves the
-- next one four weeks from that day.
--
-- Run this in the Supabase SQL editor BEFORE using a build that includes the
-- feature: without these columns the client's writes are rejected.

alter table public.chores
  add column if not exists schedule_mode text not null default 'fixed'
    check (schedule_mode in ('fixed', 'rolling')),
  -- Only rolling chores use this; it is the single day the chore is next due.
  add column if not exists next_due_date date;

-- A rolling chore is meaningless without a next date, and a fixed one must not
-- carry a stale one.
alter table public.chores
  drop constraint if exists chores_rolling_needs_next_due;

alter table public.chores
  add constraint chores_rolling_needs_next_due check (
    (schedule_mode = 'rolling' and next_due_date is not null)
    or (schedule_mode = 'fixed' and next_due_date is null)
  );

-- The reminder sender resolves a rolling chore by its own date, not by
-- replaying the recurrence from start_date.
create or replace function public.chore_is_due_on(
  recurrence jsonb,
  start_date date,
  target date
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  preset text := recurrence ->> 'preset';
  target_dow int := extract(dow from target)::int;
  start_dow int := extract(dow from start_date)::int;
  chosen_dow int;
  anchor date;
  custom jsonb;
  unit text;
  every int;
begin
  if target < start_date then
    return false;
  end if;

  case preset
    when 'once' then
      return target = start_date;
    when 'daily' then
      return true;
    when 'alternate' then
      return (target - start_date) % 2 = 0;
    when 'weekday' then
      return target_dow between 1 and 6;
    when 'sunday' then
      return target_dow = 0;
    when 'monthly', 'twiceMonthly', 'alternateSunday' then
      chosen_dow := case
        when preset = 'alternateSunday' then 0
        else coalesce((recurrence ->> 'weekday')::int, start_dow)
      end;
      if target_dow <> chosen_dow then
        return false;
      end if;
      anchor := start_date + ((chosen_dow - start_dow + 7) % 7);
      if target < anchor then
        return false;
      end if;
      every := case preset when 'monthly' then 4 else 2 end;
      return ((target - anchor) / 7) % every = 0;
    when 'custom' then
      custom := recurrence -> 'custom';
      if custom is null then
        return false;
      end if;
      unit := custom ->> 'unit';
      every := greatest(1, coalesce((custom ->> 'interval')::int, 1));
      if unit = 'day' then
        return (target - start_date) % every = 0;
      end if;
      if unit = 'week' then
        if not (
          coalesce(custom -> 'daysOfWeek', to_jsonb(array[start_dow]))
          @> to_jsonb(target_dow)
        ) then
          return false;
        end if;
        return (((target - target_dow) - (start_date - start_dow)) / 7) % every = 0;
      end if;
      if unit = 'month' then
        if not (
          coalesce(custom -> 'datesOfMonth', to_jsonb(array[extract(day from start_date)::int]))
          @> to_jsonb(extract(day from target)::int)
        ) then
          return false;
        end if;
        return (
          (extract(year from target)::int - extract(year from start_date)::int) * 12
          + (extract(month from target)::int - extract(month from start_date)::int)
        ) % every = 0;
      end if;
      return false;
    else
      return false;
  end case;
end;
$$;

revoke all on function public.chore_is_due_on(jsonb, date, date) from public, anon, authenticated;

-- due_reminders() must branch on schedule_mode: a rolling chore is due only on
-- its own next_due_date.
create or replace function public.due_reminders()
returns table (
  chore_id uuid,
  due_date date,
  snooze_count integer,
  title text,
  room text,
  push_token text,
  assignee_id uuid
)
language sql
security definer
stable
set search_path = public
as $$
  with local_now as (
    select
      p.id as profile_id,
      p.expo_push_token,
      (now() at time zone p.timezone)::date as today,
      (now() at time zone p.timezone)::time as local_time
    from public.profiles p
    where p.expo_push_token is not null
  ),
  scheduled as (
    select
      c.id, ln.today as due_date, 0 as snooze_count,
      c.title, c.room, ln.expo_push_token, c.assignee_id
    from public.chores c
    join local_now ln on ln.profile_id = c.assignee_id
    where not c.archived
      and c.reminder_time <= ln.local_time
      and case
            when c.schedule_mode = 'rolling'
              then c.next_due_date = ln.today
            else public.chore_is_due_on(c.recurrence, c.start_date, ln.today)
          end
      and not exists (
        select 1 from public.chore_snoozes s
        where s.chore_id = c.id and s.due_date = ln.today
      )
  ),
  snoozed as (
    select
      c.id, s.due_date, s.count as snooze_count,
      c.title, c.room, ln.expo_push_token, c.assignee_id
    from public.chore_snoozes s
    join public.chores c on c.id = s.chore_id
    join local_now ln on ln.profile_id = c.assignee_id
    where not c.archived
      and s.remind_at <= now()
      and s.notified_at is null
  ),
  candidates as (
    select * from scheduled
    union all
    select * from snoozed
  )
  select
    k.id, k.due_date, k.snooze_count, k.title, k.room, k.expo_push_token, k.assignee_id
  from candidates k
  where not exists (
      select 1 from public.chore_completions cc
      where cc.chore_id = k.id and cc.due_date = k.due_date
    )
    and not exists (
      select 1 from public.chore_skips cs
      where cs.chore_id = k.id and cs.due_date = k.due_date
    )
    and not exists (
      select 1 from public.reminder_deliveries rd
      where rd.chore_id = k.id
        and rd.due_date = k.due_date
        and rd.snooze_count = k.snooze_count
    );
$$;

revoke all on function public.due_reminders() from public, anon, authenticated;
