-- Row Level Security policies — defense-in-depth only.
--
-- The app connects to Postgres directly over DATABASE_URL via Drizzle, which
-- never goes through PostgREST, so auth.uid() is NULL for those queries and
-- these policies have no effect on the app's normal read/write path. The
-- real security boundary is the `user_id` filtering in src/lib/queries.ts and
-- src/lib/actions.ts. This file protects a *different* path: any future
-- supabase-js/PostgREST access (e.g. client-side realtime) that would
-- otherwise have no scoping at all.
--
-- Already applied to the live Supabase project via the Supabase MCP
-- (migration `enable_rls_policies`) — this file is the checked-in record of
-- that migration, kept in sync so a future `list_migrations` / schema diff
-- doesn't drift from what's here.
--
-- `to authenticated` (not just USING/CHECK) avoids the anon-role BOLA trap;
-- `(select auth.uid())` (not bare `auth.uid()`) lets Postgres cache it once
-- per statement instead of re-evaluating per row.

alter table workouts enable row level security;
alter table workout_sets enable row level security;
alter table plans enable row level security;
alter table plan_days enable row level security;
alter table plan_exercises enable row level security;
alter table schedule_entries enable row level security;
alter table exercises enable row level security;

create policy "workouts_owner" on workouts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "plans_owner" on plans
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "schedule_entries_owner" on schedule_entries
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Child tables have no user_id of their own — scope through the parent.
create policy "workout_sets_owner" on workout_sets
  for all to authenticated
  using (
    workout_id in (select id from workouts where user_id = (select auth.uid()))
  ) with check (
    workout_id in (select id from workouts where user_id = (select auth.uid()))
  );

create policy "plan_days_owner" on plan_days
  for all to authenticated
  using (
    plan_id in (select id from plans where user_id = (select auth.uid()))
  ) with check (
    plan_id in (select id from plans where user_id = (select auth.uid()))
  );

create policy "plan_exercises_owner" on plan_exercises
  for all to authenticated
  using (
    plan_day_id in (
      select pd.id from plan_days pd
      join plans p on p.id = pd.plan_id
      where p.user_id = (select auth.uid())
    )
  ) with check (
    plan_day_id in (
      select pd.id from plan_days pd
      join plans p on p.id = pd.plan_id
      where p.user_id = (select auth.uid())
    )
  );

-- Shared/global catalog rows (user_id is null) are readable by everyone;
-- only a user's own custom/imported rows can be written or removed.
create policy "exercises_read" on exercises
  for select to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

create policy "exercises_write_own" on exercises
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "exercises_update_own" on exercises
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "exercises_delete_own" on exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));
