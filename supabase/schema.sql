-- =============================================================================
-- CRM schema for Supabase
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> Run.
-- It is idempotent: re-running it is safe.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Keeps updated_at fresh on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on sign-up.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- companies
-- -----------------------------------------------------------------------------
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  domain     text,
  industry   text,
  phone      text,
  address    text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- contacts
-- -----------------------------------------------------------------------------
create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  first_name text not null,
  last_name  text,
  email      text,
  phone      text,
  job_title  text,
  status     text not null default 'lead'
             check (status in ('lead', 'prospect', 'customer', 'churned')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- deals
-- -----------------------------------------------------------------------------
create table if not exists public.deals (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id          uuid references public.companies (id) on delete set null,
  contact_id          uuid references public.contacts (id) on delete set null,
  title               text not null,
  value               numeric(12, 2) not null default 0,
  currency            text not null default 'EUR',
  stage               text not null default 'new'
                      check (stage in ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  probability         integer not null default 10 check (probability between 0 and 100),
  expected_close_date date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- activities: the timeline (notes, calls, emails, meetings)
-- -----------------------------------------------------------------------------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id  uuid references public.contacts (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete cascade,
  deal_id     uuid references public.deals (id) on delete cascade,
  type        text not null default 'note'
              check (type in ('note', 'call', 'email', 'meeting')),
  body        text not null,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id   uuid references public.contacts (id) on delete cascade,
  company_id   uuid references public.companies (id) on delete cascade,
  deal_id      uuid references public.deals (id) on delete cascade,
  title        text not null,
  description  text,
  due_date     date,
  priority     text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  completed    boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'companies', 'contacts', 'deals', 'tasks'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Indexes: every table is filtered by owner_id on every read.
-- -----------------------------------------------------------------------------
create index if not exists companies_owner_idx   on public.companies (owner_id);
create index if not exists contacts_owner_idx    on public.contacts (owner_id);
create index if not exists contacts_company_idx  on public.contacts (company_id);
create index if not exists deals_owner_idx       on public.deals (owner_id);
create index if not exists deals_stage_idx       on public.deals (owner_id, stage);
create index if not exists deals_company_idx     on public.deals (company_id);
create index if not exists activities_owner_idx  on public.activities (owner_id, occurred_at desc);
create index if not exists activities_contact_idx on public.activities (contact_id);
create index if not exists activities_deal_idx   on public.activities (deal_id);
create index if not exists tasks_owner_idx       on public.tasks (owner_id, completed, due_date);

-- =============================================================================
-- Row Level Security
--
-- The anon key ships inside the GitHub Pages bundle and is public by design.
-- RLS is therefore the ONLY thing standing between one user's data and another's.
-- Every table below is private-per-owner: you can only see rows you created.
-- =============================================================================

alter table public.profiles   enable row level security;
alter table public.companies  enable row level security;
alter table public.contacts   enable row level security;
alter table public.deals      enable row level security;
alter table public.activities enable row level security;
alter table public.tasks      enable row level security;

-- profiles: a user reads and edits only their own profile row.
drop policy if exists "profiles are self-service" on public.profiles;
create policy "profiles are self-service" on public.profiles
  for all
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- The five CRM tables share the identical owner_id rule.
do $$
declare
  t text;
begin
  foreach t in array array['companies', 'contacts', 'deals', 'activities', 'tasks'] loop
    execute format('drop policy if exists "owner can read" on public.%I', t);
    execute format('drop policy if exists "owner can insert" on public.%I', t);
    execute format('drop policy if exists "owner can update" on public.%I', t);
    execute format('drop policy if exists "owner can delete" on public.%I', t);

    execute format(
      'create policy "owner can read" on public.%I
       for select to authenticated using ((select auth.uid()) = owner_id)', t);
    execute format(
      'create policy "owner can insert" on public.%I
       for insert to authenticated with check ((select auth.uid()) = owner_id)', t);
    execute format(
      'create policy "owner can update" on public.%I
       for update to authenticated
       using ((select auth.uid()) = owner_id)
       with check ((select auth.uid()) = owner_id)', t);
    execute format(
      'create policy "owner can delete" on public.%I
       for delete to authenticated using ((select auth.uid()) = owner_id)', t);
  end loop;
end;
$$;
