import { useContext } from 'react'
import { DataClientContext } from './provider'
import type { DataClient } from './client'

export { DataClientProvider } from './provider'
export type { DataClient } from './client'
export * from './types'

export function useDataClient(): DataClient {
  const ctx = useContext(DataClientContext)
  if (!ctx) throw new Error('useDataClient must be used within DataClientProvider')
  return ctx
}
