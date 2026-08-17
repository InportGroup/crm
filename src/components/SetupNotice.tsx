/**
 * Shown instead of the app when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
 * missing, so a fresh clone explains itself rather than throwing at runtime.
 */
export function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-xl p-8">
        <h1 className="text-xl font-semibold text-slate-900">Connect Supabase to continue</h1>
        <p className="mt-2 text-sm text-slate-600">
          This CRM stores everything in Supabase. Create a project, then point the app at it.
        </p>

        <ol className="mt-6 space-y-4 text-sm text-slate-700">
          <li className="flex gap-3">
            <Step n={1} />
            <span>
              Create a project at{' '}
              <a
                className="font-medium text-indigo-600 hover:underline"
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
              >
                supabase.com/dashboard
              </a>
              .
            </span>
          </li>
          <li className="flex gap-3">
            <Step n={2} />
            <span>
              Open <strong>SQL Editor</strong> and run the contents of{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">supabase/schema.sql</code>.
            </span>
          </li>
          <li className="flex gap-3">
            <Step n={3} />
            <span>
              Copy <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.example</code> to{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.local</code> and paste
              your Project URL and anon key from <strong>Project Settings → API Keys</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <Step n={4} />
            <span>
              Restart the dev server — Vite only reads{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.local</code> at startup.
            </span>
          </li>
        </ol>
      </div>
    </div>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
      {n}
    </span>
  )
}
