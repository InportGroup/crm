import { useState, type FormEvent, type ReactNode } from 'react'
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail, useAuth } from '../context/auth'
import { ErrorNote, Field } from '../components/ui'
import { LogoMark } from '../components/Logo'

type Mode = 'signin' | 'signup' | 'forgot'

export function Login() {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function switchTo(next: Mode) {
    setMode(next)
    setError('')
    setNotice('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else if (mode === 'signup') {
        const { needsConfirmation } = await signUp(email, password, name)
        if (needsConfirmation) {
          // switchTo clears the banners, so set the notice after it.
          switchTo('signin')
          setNotice('Check your inbox to confirm your address, then sign in.')
        }
      } else {
        await requestPasswordReset(email)
        // Deliberately not revealing whether the address exists.
        setNotice(
          'If that address has an account, a reset link is on its way. The link expires in one hour.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const domainWarning =
    mode === 'signup' && email.includes('@') && !isAllowedEmail(email)
      ? `Only @${ALLOWED_EMAIL_DOMAIN} addresses can sign up.`
      : ''

  return (
    <AuthShell
      title={
        mode === 'signin'
          ? 'Sign in to your workspace'
          : mode === 'signup'
            ? 'Create your workspace'
            : 'Reset your password'
      }
    >
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        {error && <ErrorNote message={error} />}
        {notice && (
          <p className="border-ok-ink/25 bg-ok-soft text-ok-ink rounded-lg border px-3 py-2 text-sm">
            {notice}
          </p>
        )}

        {mode === 'forgot' && (
          <p className="text-muted text-sm">
            Enter your work address and we'll email you a link to choose a new password.
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

        <Field
          label="Email"
          hint={mode === 'signup' ? `Must be an @${ALLOWED_EMAIL_DOMAIN} address.` : undefined}
        >
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
            required
          />
        </Field>

        {domainWarning && <p className="text-warn-ink -mt-2 text-xs">{domainWarning}</p>}

        {mode !== 'forgot' && (
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
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy
            ? 'Working…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : 'Send reset link'}
        </button>

        {mode === 'signin' && (
          <button
            type="button"
            className="text-brand w-full text-center text-sm font-medium hover:underline"
            onClick={() => switchTo('forgot')}
          >
            Forgot your password?
          </button>
        )}

        <p className="text-muted text-center text-sm">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <LinkButton onClick={() => switchTo('signup')}>Sign up</LinkButton>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <LinkButton onClick={() => switchTo('signin')}>Sign in</LinkButton>
            </>
          )}
        </p>
      </form>
    </AuthShell>
  )
}

/**
 * Shown when the user arrives from a reset link: they already hold a recovery
 * session, so all that is left is choosing the new password.
 */
export function UpdatePassword() {
  const { updatePassword, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await updatePassword(password)
      // recovery flips to false, dropping the user into the CRM signed in.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the password.')
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        {error && <ErrorNote message={error} />}

        <Field label="New password" hint="At least 6 characters.">
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>

        <Field label="Confirm new password">
          <input
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </button>

        <button
          type="button"
          className="text-muted w-full text-center text-sm hover:underline"
          onClick={() => void signOut()}
        >
          Cancel and sign out
        </button>
      </form>
    </AuthShell>
  )
}

function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Soft brand glow behind the card. */}
      <div
        aria-hidden
        className="bg-brand/20 pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2.5 text-center">
          <LogoMark size={44} />
          <h1 className="text-ink text-xl font-semibold tracking-tight">
            IPG<span className="text-subtle mx-px">-</span>CRM
          </h1>
          <p className="text-muted text-sm">{title}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="text-brand font-medium hover:underline"
      onClick={onClick}
    >
      {children}
    </button>
  )
}
