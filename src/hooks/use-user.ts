import { useCallback } from 'react'
import { useLocalStorage } from '@/lib/storage'
import { defaultFakeStats, defaultUser } from '@/data/default-user'
import type { FakeStats, User } from '@/lib/types'

export function useUser() {
  const [user, setUser] = useLocalStorage<User>('user', defaultUser)
  const updateUser = useCallback(
    (partial: Partial<User>) => setUser((u) => ({ ...u, ...partial })),
    [setUser],
  )
  return { user, updateUser }
}

// Faked reading stats, tunable from Settings for demos. Not computed from anything.
export function useFakeStats() {
  const [stats, setStats] = useLocalStorage<FakeStats>('fakeStats', defaultFakeStats)
  const updateStats = useCallback(
    (partial: Partial<FakeStats>) => setStats((s) => ({ ...s, ...partial })),
    [setStats],
  )
  return { stats, updateStats }
}
