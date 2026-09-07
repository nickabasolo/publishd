import { createContext, useMemo, type ReactNode } from 'react'
import type { DataClient } from './client'
import { localDataClient } from './local/client'
import { supabaseDataClient } from './supabase/client'

export const DataClientContext = createContext<DataClient | null>(null)

function selectClient(): DataClient {
  const backend = import.meta.env.VITE_DATA_BACKEND ?? 'local'
  if (backend === 'supabase') return supabaseDataClient
  if (backend !== 'local') {
    console.warn(`[data] Unknown VITE_DATA_BACKEND "${backend}" — falling back to "local".`)
  }
  return localDataClient
}

export function DataClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(selectClient, [])
  return <DataClientContext.Provider value={client}>{children}</DataClientContext.Provider>
}
