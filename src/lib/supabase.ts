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
      detectSessionInUrl: true,
      // PKCE returns the recovery/confirmation token as a ?code= QUERY param.
      // The implicit flow would put it in the URL fragment, where it collides
      // with HashRouter's own "#/route" and gets eaten before supabase-js
      // can read it. Query params sit before the hash, so both survive.
      flowType: 'pkce',
    },
  },
)
