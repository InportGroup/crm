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

## How the security model works

The Supabase **project URL** and **publishable (anon) key** are compiled into the JavaScript
bundle. That is expected — they are public credentials. The only thing separating your data from
anyone else's is **Row Level Security**, so every table in [`supabase/schema.sql`](supabase/schema.sql)
has RLS enabled with four owner-scoped policies:

```sql
using ((select auth.uid()) = owner_id)
```

You can only read, insert, update or delete rows where `owner_id` is your own user id.
`owner_id` defaults to `auth.uid()` on insert, so the client never sets it.

Two rules follow from this:

- **Never** put the `service_role` key or the database password in this repo. They bypass RLS.
- Any new table you add needs `enable row level security` plus policies, or it is world-readable.

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

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and deploys on every push
to `main`.

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   These are repository *variables*, not secrets — they are public values, and secrets would only
   give a false sense of protection since they end up in the bundle either way.
3. Push to `main`.

### Two Pages details worth knowing

- **Base path.** A project site is served from `https://<owner>.github.io/<repo>/`, so the
  workflow sets `BASE_PATH=/<repo>/` at build time. If you ever move this to a
  `<owner>.github.io` repo, change `BASE_PATH` to `/`.
- **Hash routing.** Pages has no server-side rewrite, so a hard refresh on `/contacts` would
  404. The app uses `HashRouter`, which makes URLs look like `/#/contacts` and always resolves.

### Supabase redirect URLs

For confirmation and password-reset links to come back to the deployed app, add the Pages URL
under **Authentication → URL Configuration**:

- **Site URL**: `https://<owner>.github.io/<repo>/`
- **Redirect URLs**: `https://<owner>.github.io/<repo>/**` and `http://localhost:5173/**`

## Project layout

```
supabase/schema.sql      tables, indexes, triggers, RLS policies
supabase/seed.sql        optional demo data
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

## Extending it

The pieces you are most likely to want next:

- **Activity timeline UI.** The `activities` table, types and `listActivities`/`createActivity`
  already exist and the dashboard renders them; there is no page to add one from yet.
- **Detail pages.** Contacts and companies are list-only. A `/contacts/:id` route showing that
  person's deals, tasks and activities is the natural next step.
- **Sharing between teammates.** Today every row is private to its creator. Multi-user access
  means a `teams`/`memberships` table and swapping the RLS predicate from `owner_id = auth.uid()`
  to a membership lookup.
