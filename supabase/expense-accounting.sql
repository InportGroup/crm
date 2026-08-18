-- =============================================================================
-- Accounting fields for expenses.
--
-- Adds:
--   * cost_type      — direct (billable to a project/client) vs structural
--                      (general overhead). This is what the dashboard splits on.
--   * net_amount     — taxable base ("base imponible")
--   * tax_rate       — VAT percentage applied to the base
--   * tax_amount     — VAT in currency, stored rather than derived so historical
--                      rows keep the figure that was actually on the invoice
--                      even if a rate is edited or rounding differs.
--   * reimbursable   — the expense is owed back to whoever paid it
--   * reimbursed_on  — when the money was actually returned
--   * reimbursed_by  — who confirmed / made the reimbursement
--
-- `amount` stays the gross total (base + VAT) so every existing total, chart
-- and filter in the app keeps working untouched.
--
-- Also widens the category check to include cloud services.
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
alter table public.expenses
  add column if not exists cost_type text not null default 'structural',
  add column if not exists net_amount numeric(12, 2) not null default 0,
  add column if not exists tax_rate numeric(5, 2) not null default 21,
  add column if not exists tax_amount numeric(12, 2) not null default 0,
  add column if not exists reimbursable boolean not null default false,
  add column if not exists reimbursed_on date,
  add column if not exists reimbursed_by uuid references public.profiles (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Constraints
--
-- Dropped and recreated rather than "add if not exists": the category check
-- already exists from expenses-and-vault.sql and has to be widened, and a
-- named constraint makes both halves idempotent.
-- -----------------------------------------------------------------------------
alter table public.expenses drop constraint if exists expenses_cost_type_check;
alter table public.expenses
  add constraint expenses_cost_type_check check (cost_type in ('direct', 'structural'));

alter table public.expenses drop constraint if exists expenses_amounts_check;
alter table public.expenses
  add constraint expenses_amounts_check
  check (net_amount >= 0 and tax_amount >= 0 and tax_rate >= 0 and tax_rate <= 100);

-- The original check was created inline and so carries the default name.
alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses
  add constraint expenses_category_check
  check (category in ('travel', 'meals', 'software', 'cloud', 'hardware', 'licenses',
                      'office', 'marketing', 'training', 'utilities',
                      'professional', 'other'));

-- Payment methods gain an explicit "company card" vs "personal cash" split so
-- reimbursable spend can be told apart from spend that already left the
-- company account.
alter table public.expenses drop constraint if exists expenses_payment_method_check;
alter table public.expenses
  add constraint expenses_payment_method_check
  check (payment_method in ('company_card', 'personal_card', 'personal_cash',
                            'transfer', 'direct_debit', 'card', 'cash', 'other'));

-- -----------------------------------------------------------------------------
-- Backfill
--
-- Existing rows only have a gross `amount`. Derive the base and VAT from it at
-- the default 21% rather than leaving zeros, which would make the new
-- accounting totals read as empty for historical spend.
-- -----------------------------------------------------------------------------
update public.expenses
   set net_amount = round(amount / 1.21, 2),
       tax_amount = amount - round(amount / 1.21, 2)
 where net_amount = 0 and amount > 0;

-- Anything already attached to a deal or company was a project cost.
update public.expenses
   set cost_type = 'direct'
 where cost_type = 'structural' and (deal_id is not null or company_id is not null);

-- Spend put on a personal method is what gets paid back.
update public.expenses
   set reimbursable = true
 where payment_method in ('cash', 'personal_cash', 'personal_card')
   and reimbursable = false;

-- Rows already marked reimbursed should carry a date for the ledger.
update public.expenses
   set reimbursed_on = coalesce(reimbursed_on, updated_at::date)
 where status = 'reimbursed' and reimbursed_on is null;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists expenses_cost_type_idx    on public.expenses (cost_type);
create index if not exists expenses_category_idx     on public.expenses (category);
create index if not exists expenses_deal_idx         on public.expenses (deal_id);
create index if not exists expenses_reimbursable_idx on public.expenses (reimbursable)
  where reimbursable;
