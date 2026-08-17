import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthState {
  session: Session | null
  user: User | null
  /** True until the initial session lookup finishes. */
  loading: boolean
  /**
   * True after Supabase hands back a recovery session from a reset link. The
   * user holds a valid session at that point, so the app must show the
   * "choose a new password" screen instead of dropping them into the CRM.
   */
  recovery: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

/** Sign-up is restricted to this domain by a trigger on auth.users. */
export const ALLOWED_EMAIL_DOMAIN = 'inportgroup.com'

export function isAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().split('@')[1] === ALLOWED_EMAIL_DOMAIN
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
