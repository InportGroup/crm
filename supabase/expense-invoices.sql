-- =============================================================================
-- Invoices and "who paid" for expenses.
--
-- Adds three columns plus a private Storage bucket for the documents.
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
alter table public.expenses
  add column if not exists invoice_number text,
  -- Storage object path, e.g. "<expense-id>/invoice.pdf". Not a public URL:
  -- the bucket is private, so the app mints short-lived signed URLs on demand.
  add column if not exists invoice_path text,
  add column if not exists invoice_name text,
  -- Who actually paid. References a profile rather than storing a name, so
  -- per-person totals stay reliable. ON DELETE SET NULL keeps the expense row
  -- if the person's account is ever removed.
  add column if not exists paid_by uuid references public.profiles (id) on delete set null;

create index if not exists expenses_paid_by_idx on public.expenses (paid_by);

-- -----------------------------------------------------------------------------
-- Backfill: existing rows were created by whoever owns them.
-- -----------------------------------------------------------------------------
update public.expenses set paid_by = owner_id where paid_by is null;

-- -----------------------------------------------------------------------------
-- Storage bucket for invoice documents.
--
-- Private (public = false). Objects are reachable only through a signed URL or
-- an authenticated request that satisfies the policies below.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices',
  'invoices',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Storage policies.
--
-- storage.objects has its own RLS, entirely separate from the expenses table.
-- Without these, uploads fail and documents are unreachable. Same
-- shared-workspace rule as the rest of the app: any authenticated user, and
-- nothing at all for anonymous callers.
-- -----------------------------------------------------------------------------
drop policy if exists "team can read invoices" on storage.objects;
drop policy if exists "team can upload invoices" on storage.objects;
drop policy if exists "team can update invoices" on storage.objects;
drop policy if exists "team can delete invoices" on storage.objects;

create policy "team can read invoices" on storage.objects
  for select to authenticated using (bucket_id = 'invoices');

create policy "team can upload invoices" on storage.objects
  for insert to authenticated with check (bucket_id = 'invoices');

create policy "team can update invoices" on storage.objects
  for update to authenticated
  using (bucket_id = 'invoices')
  with check (bucket_id = 'invoices');

create policy "team can delete invoices" on storage.objects
  for delete to authenticated using (bucket_id = 'invoices');
