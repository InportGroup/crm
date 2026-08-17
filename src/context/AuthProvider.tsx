import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, isAllowedEmail, ALLOWED_EMAIL_DOMAIN, type AuthState } from './auth'

/**
 * Where Supabase sends the user back after a confirmation or reset link.
 * BASE_URL is "/crm/" in the Pages build and "/" during local dev, so this
 * resolves correctly in both without hardcoding the deployed host.
 */
function redirectTo(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setLoading(false)
      // Fired once supabase-js has exchanged the ?code= from a reset link.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      recovery,

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },

      async signUp(email, password, fullName) {
        // The database trigger is what actually enforces this; checking here
        // only buys the user a clear message instead of a raw Postgres error.
        if (!isAllowedEmail(email)) {
          throw new Error(`Sign-up is limited to @${ALLOWED_EMAIL_DOMAIN} addresses.`)
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: redirectTo() },
        })
        if (error) throw error
        // With "Confirm email" enabled, Supabase returns a user but no session.
        return { needsConfirmation: !data.session }
      },

      async signOut() {
        setRecovery(false)
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },

      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo(),
        })
        if (error) throw error
      },

      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setRecovery(false)
      },
    }),
    [session, loading, recovery],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
