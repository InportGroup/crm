# IPG-CRM

A small, self-hosted CRM and internal admin tool for the Inport Group team: contacts, companies, a
drag-and-drop deal pipeline, tasks, an activity timeline, expense tracking and a shared password
store. The whole thing is a static React app on **GitHub Pages** talking directly to **Supabase**
for auth and data — there is no backend of your own to run.

## Stack

| Piece    | Choice                                    |
| -------- | ----------------------------------------- |
| UI       | React 19 + TypeScript + Vite              |
| Styling  | Tailwind CSS v4                           |
| Routing  | React Router (hash mode, see below)        |
| Data     | Supabase Postgres + Row Level Security    |
| Auth     | Supabase Auth (email + password)          |
| Hosting  | GitHub Pages via GitHub Actions           |

**Live:** <https://inportgroup.github.io/crm/>

## Who can get in

Two independent controls, both enforced in the database:

1. **Sign-up is limited to `@inportgroup.com`.** A `BEFORE INSERT` trigger on
   `auth.users` ([`supabase/domain-restriction.sql`](supabase/domain-restriction.sql)) rejects
   anything else. Exact-domain match, so `mail.inportgroup.com` and `evil-inportgroup.com` are
   both refused. The check in the sign-up form is only there for a readable error message —
   anyone can POST straight to `/auth/v1/signup`, so the trigger is the real boundary.
2. **Everyone who gets in shares one CRM.** See below.

Password reset is Supabase's built-in flow: **Forgot your password?** on the sign-in screen emails
a link, and the app shows a "choose a new password" screen when the user returns.

> **These two are a pair.** The shared-workspace policies let *any* authenticated user read
> *every* record. That is only safe because the domain trigger controls who can obtain an account.
> Relax the domain rule and you have opened the entire CRM.

### ⚠️ The password vault stores secrets in plain text

`vault_entries.secret` is **not encrypted**. This was a deliberate choice by the project owner,
and it has consequences worth stating plainly:

- Every teammate who can sign in can read every stored credential.
- Anyone with a database dump, the `service_role` key, or Supabase dashboard access can read them.
- RLS protects these rows from the *public internet*, not from insiders or from database access.

**Do not store** banking, payment-processor, domain-registrar or any payment-authority logins here.
Shared low-stakes logins (carrier portals, a shared inbox) are a reasonable fit.

To move to real protection later, the schema is already prepared: `vault_entries.secret_encrypted`
is a boolean that lets ciphertext rows coexist with plaintext ones. The upgrade path is to encrypt
in the browser (AES-GCM with a key derived from a vault passphrase via PBKDF2), write ciphertext
with the flag set, and decrypt only flagged rows — no schema change, no data loss.

## How the security model works

The Supabase **project URL** and **publishable (anon) key** are compiled into the JavaScript
bundle. That is expected — they are public credentials. The only thing separating your data from
the open internet is **Row Level Security**, and every table has it enabled.

The policies are **shared-workspace**: any *authenticated* user can read and edit every record.

```sql
for select to authenticated using (true)
```

An anonymous visitor holding the publishable key sees **zero rows**, because every policy is
granted `to authenticated` only. `owner_id` still records who created each row, and the insert
policy pins it to the caller so attribution cannot be forged:

```sql
for insert to authenticated with check ((select auth.uid()) = owner_id)
```

Three rules follow from this:

- **Never** put the `service_role` key or the database password in this repo. They bypass RLS.
- Any new table you add needs `enable row level security` plus policies, or it is world-readable.
- Keep the domain trigger in place. It is what makes "all authenticated users" a safe set.

### Invoice documents

Invoices live in a **private** Supabase Storage bucket (`invoices`, 10 MB cap, PDF/JPEG/PNG/HEIC/
WebP only). `storage.objects` has its own RLS, entirely separate from the `expenses` table, so
[`supabase/expense-invoices.sql`](supabase/expense-invoices.sql) adds four policies granting access
to `authenticated` and nothing to anonymous callers.

Because the bucket is private, the app never renders a static file URL — it mints a **signed URL**
valid for five minutes when you click *View*. A plain public URL would 400.

`expenses.invoice_path` stores the object path, not a URL. Deleting an expense removes its document
first, so a failure there cannot orphan a file with no row pointing at it.

> Storage rows cannot be deleted with SQL — a `protect_delete` trigger blocks it. Use the Storage
> API (which is what the app does) or the dashboard.

### Expense accounting model

Every expense carries the figures an invoice actually shows, rather than a single number:

| Field                     | Meaning                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `net_amount`              | Taxable base — what the user types in                          |
| `tax_rate` / `tax_amount` | VAT percentage and the resulting figure                        |
| `amount`                  | Gross total (`net_amount + tax_amount`), kept in sync on save   |

`amount` stays the gross total so every pre-existing total, chart and filter keeps working; the
base and VAT are stored alongside rather than recomputed, so a historical row keeps the figure that
was on its invoice even if a rate is edited later.

`cost_type` splits spend two ways, and is what the dashboard reports on:

- **direct** — belongs to a project or client, so it can be billed on. Link it with the *Client*
  and *Project* dropdowns on the expense form.
- **structural** — general overhead the company carries either way.

Reimbursements are a small workflow of their own. Choosing a personal payment method ticks
`reimbursable`, which is what the *To reimburse* and *Owed to* totals count. Confirming a
reimbursement writes `status`, `reimbursed_on` and `reimbursed_by` in one update, so the ledger
cannot half-apply.

### Running the SQL

Apply in this order (all are idempotent):

| File                                                                 | Purpose                                    |
| -------------------------------------------------------------------- | ------------------------------------------ |
| [`supabase/schema.sql`](supabase/schema.sql)                           | Tables, indexes, triggers, baseline RLS     |
| [`supabase/domain-restriction.sql`](supabase/domain-restriction.sql)   | Limit sign-up to `@inportgroup.com`         |
| [`supabase/shared-workspace.sql`](supabase/shared-workspace.sql)       | Swap owner-scoped RLS for shared-team RLS   |
| [`supabase/expenses-and-vault.sql`](supabase/expenses-and-vault.sql) | Expenses + password vault tables and RLS    |
| [`supabase/expense-invoices.sql`](supabase/expense-invoices.sql)     | Invoice columns, paid_by, invoices bucket    |
| [`supabase/expense-accounting.sql`](supabase/expense-accounting.sql) | Cost type, VAT columns, reimbursement fields |
| [`supabase/seed.sql`](supabase/seed.sql)                               | Optional demo data                          |

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev
```

`.env.local` needs:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable or anon key>
```

Both come from **Supabase → Project Settings → API Keys**. `.env.local` is gitignored.
If the variables are missing the app renders a setup screen instead of crashing.

Vite reads env files only at startup — restart `npm run dev` after editing `.env.local`.

## Database setup

In the Supabase dashboard, open **SQL Editor → New query** and run the files listed under
[Running the SQL](#running-the-sql) in order. Each is idempotent, so re-running is safe.

`seed.sql` is optional demo data; it attaches everything to the oldest user in `auth.users`, so
sign up first.

### Email confirmation

This project has **Confirm email** enabled, so a new sign-up must click the link in their inbox
before they can sign in. The sign-up form tells the user this. To skip it while testing:
**Authentication → Sign In / Providers → Email → turn off "Confirm email"**.

Supabase's built-in mailer is rate-limited to a handful of messages per hour. Configure a real
SMTP provider before letting anyone else sign up.

## Deploying to GitHub Pages

Deploys are automated. Push to `main` and
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes:

```bash
git push origin main
```

Pages is set to **Source: GitHub Actions**, and the two repository *variables*
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` supply the build. They are variables rather than
secrets deliberately — they are public values, and secrets would only give a false sense of
protection since they end up in the bundle either way.

The `gh-pages` branch is a leftover from the original branch-based deploy and is no longer read.

### Two Pages details worth knowing

- **Base path.** A project site is served from `https://<owner>.github.io/<repo>/`, so the
  workflow sets `BASE_PATH=/<repo>/` at build time. If you ever move this to a
  `<owner>.github.io` repo, change `BASE_PATH` to `/`.
- **Hash routing.** Pages has no server-side rewrite, so a hard refresh on `/contacts` would
  404. The app uses `HashRouter`, which makes URLs look like `/#/contacts` and always resolves.

### Supabase redirect URLs (required for reset + confirmation)

Confirmation and password-reset links only return to the app if the URL is allow-listed under
**Authentication → URL Configuration**:

- **Site URL**: `https://inportgroup.github.io/crm/`
- **Redirect URLs**: `https://inportgroup.github.io/crm/**` and `http://localhost:5173/**`

Without these, the emailed link bounces to Supabase's default and the user never reaches the
"choose a new password" screen.

## What's in it

- **Dashboard** — pipeline by stage, open/won totals, overdue tasks, recent activity.
- **Contacts** — searchable, status-filtered, with a detail drawer showing linked deals, open
  tasks and a full activity timeline.
- **Companies** — contact count and open pipeline per organisation.
- **Deals** — kanban pipeline with drag-and-drop on desktop and a "Move to…" picker on touch,
  plus weighted-pipeline and win-rate figures.
- **Tasks** — open / due / done filters, overdue highlighting, one-tap completion.
- **Expenses** (Internal) — internal spend with category, vendor, payment method and an approval
  workflow (pending → approved → reimbursed / rejected). Records **who paid** (picked from
  teammates who have signed in) and attaches the **invoice** — a reference number plus the PDF or
  photo itself. Month / pending / to-reimburse totals, a category breakdown, and an "Owed to"
  panel showing unreimbursed spend per person. Optionally linked to a company or deal when spend
  is billable.
- **Passwords** (Internal) — shared credential store with masked secrets, reveal toggle,
  copy-to-clipboard and a strong password generator. **See the warning below.**
- **Activity log** — calls, notes, emails and meetings against any contact or deal.
- **⌘K search** — one palette across contacts, companies and deals.
- **Dark mode** — follows the OS by default, with a manual toggle that persists.
- **Mobile** — bottom tab bar, card layouts in place of tables, and bottom-sheet dialogs.

### Design system

Colours are semantic CSS variables (`--c-ink`, `--c-surface`, `--c-brand`, …) exposed to Tailwind
through `@theme inline` in [`src/index.css`](src/index.css). Dark mode re-points those variables
under `[data-theme='dark']`, so components use `bg-surface` / `text-ink` and almost never need a
`dark:` variant. A small inline script in `index.html` sets the attribute before first paint to
avoid a white flash.

### Extending it

- **Detail pages.** Contacts and companies are list-only. A `/contacts/:id` route showing that
  person's deals, tasks and activities is the natural next step.
- **Show who created what.** `owner_id` and the `profiles` table are populated and readable by the
  team, but no screen surfaces them yet.

## Project layout

```
supabase/schema.sql              tables, indexes, triggers, baseline RLS
supabase/domain-restriction.sql  @inportgroup.com sign-up trigger
supabase/shared-workspace.sql    shared-team RLS policies
supabase/expenses-and-vault.sql  expenses + vault tables and RLS
supabase/expense-invoices.sql    invoice columns, paid_by, invoices bucket
supabase/expense-accounting.sql  cost type, VAT, reimbursement columns
supabase/seed.sql                optional demo data
.github/workflows/deploy.yml     builds and publishes to Pages on push to main
src/index.css                    design tokens, dark mode, component classes
src/lib/supabase.ts              client + "is it configured?" check
src/lib/api.ts                   one typed function per query
src/lib/types.ts                 row types and the stage/status enums
src/context/                     auth, theme and feedback (toast/confirm) providers
src/hooks/                       useAsyncData: load, error, reload
src/components/                  Layout, Modal, CommandPalette, ActivityFeed, Logo, UI primitives
src/pages/                       Dashboard, Contacts, Companies, Deals, Tasks, Expenses, Vault, Login
```

## Scripts

| Command           | Does                                  |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Dev server on <http://localhost:5173> |
| `npm run build`   | Type-check, then build to `dist/`     |
| `npm run preview` | Serve the production build locally    |
| `npm run lint`    | oxlint                                |
