// Singleton browser Supabase client. Created lazily-but-eagerly at module
// load — cheap (no network call until a query runs) and matches how every
// other backend-agnostic module in src/lib/data is structured.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (import.meta.env.VITE_DATA_BACKEND === 'supabase' && (!url || !anonKey)) {
  // Do not throw: throwing here would crash the whole app at import time
  // (this module is imported by provider.tsx regardless of which backend is
  // selected). Every query will instead fail with a clear Supabase error the
  // first time it actually runs.
  console.warn(
    '[data/supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — ' +
      'Supabase requests will fail until .env.local is filled in.',
  )
}

export const supabase = createClient(url ?? 'https://placeholder.invalid', anonKey ?? 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
