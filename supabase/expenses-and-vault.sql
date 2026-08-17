-- =============================================================================
-- Two new modules: internal expenses, and a shared credential vault.
--
-- Both follow the shared-workspace rule already used by the CRM tables: any
-- authenticated user reads and edits everything, owner_id records who created
-- the row, and the insert check pins it to the caller so it cannot be forged.
--
-- This leans on the @inportgroup.com sign-up trigger in domain-restriction.sql.
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- expenses
-- -----------------------------------------------------------------------------
create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id     uuid references public.companies (id) on delete set null,
  deal_id        uuid references public.deals (id) on delete set null,
  description    text not null,
  amount         numeric(12, 2) not null default 0 check (amount >= 0),
  currency       text not null default 'EUR',
  category       text not null default 'other'
                 check (category in ('travel', 'meals', 'software', 'hardware',
                                     'office', 'marketing', 'training', 'utilities',
                                     'professional', 'other')),
  spent_on       date not null default current_date,
  vendor         text,
  payment_method text not null default 'card'
                 check (payment_method in ('card', 'cash', 'transfer', 'direct_debit', 'other')),
  status         text not null default 'pending'
                 check (status in ('pending', 'approved', 'reimbursed', 'rejected')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- vault_entries
--
-- NOTE ON SECRETS: `secret` currently holds plain text, at the owner's explicit
-- request. Anyone who can authenticate can read every row here, and so can
-- anyone with a database dump or the service_role key.
--
-- `secret_encrypted` exists so client-side encrypted values can be introduced
-- later without a schema change: new rows would store ciphertext with the flag
-- set to true, and the app decrypts only those. Until then it stays false.
-- -----------------------------------------------------------------------------
create table if not exists public.vault_entries (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id       uuid references public.companies (id) on delete set null,
  title            text not null,
  username         text,
  secret           text not null default '',
  secret_encrypted boolean not null default false,
  url              text,
  category         text not null default 'other'
                   check (category in ('portal', 'email', 'banking', 'social',
                                       'software', 'server', 'other')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- updated_at triggers (public.set_updated_at comes from schema.sql)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['expenses', 'vault_entries'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists expenses_owner_idx    on public.expenses (owner_id);
create index if not exists expenses_spent_idx    on public.expenses (spent_on desc);
create index if not exists expenses_status_idx   on public.expenses (status);
create index if not exists expenses_company_idx  on public.expenses (company_id);
create index if not exists vault_owner_idx       on public.vault_entries (owner_id);
create index if not exists vault_company_idx     on public.vault_entries (company_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.expenses      enable row level security;
alter table public.vault_entries enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['expenses', 'vault_entries'] loop
    execute format('drop policy if exists "team can read" on public.%I', t);
    execute format('drop policy if exists "team can insert" on public.%I', t);
    execute format('drop policy if exists "team can update" on public.%I', t);
    execute format('drop policy if exists "team can delete" on public.%I', t);

    execute format(
      'create policy "team can read" on public.%I
       for select to authenticated using (true)', t);
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
