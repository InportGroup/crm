import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/auth'
import { ErrorNote, Field } from '../components/ui'

type Mode = 'signin' | 'signup'

export function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        const { needsConfirmation } = await signUp(email, password, name)
        if (needsConfirmation) {
          setNotice('Check your inbox to confirm your address, then sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            C
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Clientela CRM</h1>
          <p className="text-sm text-slate-500">
            {mode === 'signin' ? 'Sign in to your workspace' : 'Create your workspace'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          {error && <ErrorNote message={error} />}
          {notice && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {notice}
            </p>
          )}

          {mode === 'signup' && (
            <Field label="Full name">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </Field>
          )}

          <Field label="Email">
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>

          <Field label="Password" hint={mode === 'signup' ? 'At least 6 characters.' : undefined}>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </Field>

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <p className="text-center text-sm text-slate-500">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              className="font-medium text-indigo-600 hover:underline"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError('')
                setNotice('')
              }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
