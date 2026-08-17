import { LogoMark } from './Logo'

/**
 * Shown instead of the app when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
 * missing, so a fresh clone explains itself rather than throwing at runtime.
 */
export function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="card w-full max-w-xl p-6 sm:p-8">
        <LogoMark size={40} />
        <h1 className="text-ink mt-4 text-xl font-semibold">Connect Supabase to continue</h1>
        <p className="text-muted mt-2 text-sm">
          IPG-CRM stores everything in Supabase. Create a project, then point the app at it.
        </p>

        <ol className="text-muted mt-6 space-y-4 text-sm">
          <li className="flex gap-3">
            <Step n={1} />
            <span>
              Create a project at{' '}
              <a
                className="text-brand font-medium hover:underline"
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
              Open <strong className="text-ink">SQL Editor</strong> and run{' '}
              <Code>supabase/schema.sql</Code>, then <Code>supabase/domain-restriction.sql</Code>{' '}
              and <Code>supabase/shared-workspace.sql</Code>.
            </span>
          </li>
          <li className="flex gap-3">
            <Step n={3} />
            <span>
              Copy <Code>.env.example</Code> to <Code>.env.local</Code> and paste your Project URL
              and publishable key from <strong className="text-ink">Project Settings → API Keys</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <Step n={4} />
            <span>
              Restart the dev server — Vite only reads <Code>.env.local</Code> at startup.
            </span>
          </li>
        </ol>
      </div>
    </div>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span className="bg-brand flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white">
      {n}
    </span>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-neutral-soft text-ink rounded px-1.5 py-0.5 text-xs">{children}</code>
}
