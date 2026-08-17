-- =============================================================================
-- Switch from private-per-user to a single shared workspace.
--
-- The original policies scoped every row to its creator (owner_id = auth.uid()),
-- which means a second teammate signing in would see an empty CRM. This replaces
-- them so that ANY authenticated user can read and edit ALL CRM records.
--
-- That is safe here only because sign-up is already restricted to
-- @inportgroup.com by the trigger in domain-restriction.sql. Those two files are
-- a pair: relax the domain rule and you have opened the whole CRM to the public.
--
-- owner_id is kept, but it now means "who created this row" (attribution),
-- not "who is allowed to see it".
--
-- Idempotent: safe to re-run.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['companies', 'contacts', 'deals', 'activities', 'tasks'] loop
    -- Drop the owner-scoped policies from schema.sql.
    execute format('drop policy if exists "owner can read" on public.%I', t);
    execute format('drop policy if exists "owner can insert" on public.%I', t);
    execute format('drop policy if exists "owner can update" on public.%I', t);
    execute format('drop policy if exists "owner can delete" on public.%I', t);

    -- ...and the shared ones, so re-running this file is clean.
    execute format('drop policy if exists "team can read" on public.%I', t);
    execute format('drop policy if exists "team can insert" on public.%I', t);
    execute format('drop policy if exists "team can update" on public.%I', t);
    execute format('drop policy if exists "team can delete" on public.%I', t);

    execute format(
      'create policy "team can read" on public.%I
       for select to authenticated using (true)', t);

    -- Insert still pins owner_id to the caller so "created by" cannot be forged.
    execute format(
      'create policy "team can insert" on public.%I
       for insert to authenticated with check ((select auth.uid()) = owner_id)', t);

    execute format(
      'create policy "team can update" on public.%I
       for update to authenticated using (true) with check (true)', t);

    execute format(
      'create policy "team can delete" on public.%I
       for delete to authenticated using (true)', t);
  end loop;
end;
$$;

-- Profiles: everyone can read teammate names (to show "created by"),
-- but you can still only edit your own row.
drop policy if exists "profiles are self-service" on public.profiles;
drop policy if exists "profiles readable by team" on public.profiles;
drop policy if exists "profiles editable by self" on public.profiles;

create policy "profiles readable by team" on public.profiles
  for select to authenticated using (true);

create policy "profiles editable by self" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
