import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * False until the two VITE_SUPABASE_* env vars are set. The app renders a setup
 * screen instead of crashing, which keeps `npm run dev` useful before the
 * Supabase project exists.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // GitHub Pages serves the app under a hash route, so let supabase-js read
      // the OAuth/magic-link fragment on return.
      detectSessionInUrl: true,
    },
  },
)
