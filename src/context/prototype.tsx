import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocalStorage } from '@/lib/storage'
import type { Persona } from '@/lib/types'

interface PrototypeValue {
  persona: Persona
  setPersona: (p: Persona) => void
}

const PrototypeContext = createContext<PrototypeValue | null>(null)

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useLocalStorage<Persona>('persona', 'reader')
  const value = useMemo(() => ({ persona, setPersona }), [persona, setPersona])
  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>
}

export function usePrototype() {
  const ctx = useContext(PrototypeContext)
  if (!ctx) throw new Error('usePrototype must be used within PrototypeProvider')
  return ctx
}
