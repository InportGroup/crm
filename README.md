# Clientela CRM

A small, self-hosted CRM: contacts, companies, a drag-and-drop deal pipeline, tasks and an
activity timeline. The whole thing is a static React app on **GitHub Pages** talking directly to
**Supabase** for auth and data — there is no backend of your own to run.

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

### Running the SQL

Apply in this order (all are idempotent):

| File                                                                 | Purpose                                    |
| -------------------------------------------------------------------- | ------------------------------------------ |
| [`supabase/schema.sql`](supabase/schema.sql)                           | Tables, indexes, triggers, baseline RLS     |
| [`supabase/domain-restriction.sql`](supabase/domain-restriction.sql)   | Limit sign-up to `@inportgroup.com`         |
| [`supabase/shared-workspace.sql`](supabase/shared-workspace.sql)       | Swap owner-scoped RLS for shared-team RLS   |
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

In the Supabase dashboard, open **SQL Editor → New query**, paste
[`supabase/schema.sql`](supabase/schema.sql) and run it. It is idempotent, so re-running is safe.

Optionally run [`supabase/seed.sql`](supabase/seed.sql) afterwards for demo records. It attaches
everything to the oldest user in `auth.users`, so sign up first.

### Email confirmation

This project has **Confirm email** enabled, so a new sign-up must click the link in their inbox
before they can sign in. The sign-up form tells the user this. To skip it while testing:
**Authentication → Sign In / Providers → Email → turn off "Confirm email"**.

Supabase's built-in mailer is rate-limited to a handful of messages per hour. Configure a real
SMTP provider before letting anyone else sign up.

## Deploying to GitHub Pages

The site is currently published from the **`gh-pages` branch**, which holds the built output.
To publish a change:

```bash
npm run build          # BASE_PATH=/crm/ is set by the deploy script below
cd dist
git add -A && git commit -m "Deploy" && git push --force origin gh-pages
```

The `dist/` folder is its own small git repo pointed at the same remote, which is why the
force-push is safe — it only ever rewrites `gh-pages`.

### Switching to automated deploys

[`deploy/github-pages.yml`](deploy/github-pages.yml) is a ready GitHub Actions workflow that
builds and deploys on every push to `main`. It is **not** at `.github/workflows/` yet because the
token used to create this repo lacks the `workflow` OAuth scope, and GitHub refuses that path over
both `git push` and the REST API. To enable it:

```bash
gh auth refresh -h github.com -s workflow
mkdir -p .github/workflows
git mv deploy/github-pages.yml .github/workflows/deploy.yml
git commit -m "Enable Pages deploy workflow" && git push
```

Then set **Settings → Pages → Source: GitHub Actions**. The two repository *variables*
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are already configured. They are variables rather
than secrets deliberately — they are public values, and secrets would only give a false sense of
protection since they end up in the bundle either way.

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

### Extending it

- **Activity timeline UI.** The `activities` table, types and `listActivities`/`createActivity`
  already exist and the dashboard renders them; there is no page to add one from yet.
- **Detail pages.** Contacts and companies are list-only. A `/contacts/:id` route showing that
  person's deals, tasks and activities is the natural next step.
- **Show who created what.** `owner_id` and the `profiles` table are populated and readable by the
  team, but no screen surfaces them yet.

## Project layout

```
supabase/schema.sql            tables, indexes, triggers, baseline RLS
supabase/domain-restriction.sql  @inportgroup.com sign-up trigger
supabase/shared-workspace.sql    shared-team RLS policies
supabase/seed.sql              optional demo data
deploy/github-pages.yml        Actions workflow (see "Switching to automated deploys")
src/lib/supabase.ts      client + "is it configured?" check
src/lib/api.ts           one typed function per query
src/lib/types.ts         row types and the stage/status enums
src/context/             auth context and provider
src/hooks/               useAsyncData: load, error, reload
src/components/          Layout, Modal, shared UI primitives
src/pages/               Dashboard, Contacts, Companies, Deals, Tasks, Login
```

## Scripts

| Command           | Does                                  |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Dev server on <http://localhost:5173> |
| `npm run build`   | Type-check, then build to `dist/`     |
| `npm run preview` | Serve the production build locally    |
| `npm run lint`    | oxlint                                |
