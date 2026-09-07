import { useCallback } from 'react'
import { useLocalStorage } from '@/lib/storage'
import { useAccount } from '@/context/account'
import { ACCOUNTS } from '@/data/accounts'
import type { FakeStats, User } from '@/lib/types'

// Identity + stats are per fake account, so switching accounts in the banner
// swaps who "you" are everywhere useUser is consumed.
export function useUser() {
  const { accountId } = useAccount()
  const [user, setUser] = useLocalStorage<User>(
    `user:${accountId}`,
    ACCOUNTS[accountId].user,
  )
  const updateUser = useCallback(
    (partial: Partial<User>) => setUser((u) => ({ ...u, ...partial })),
    [setUser],
  )
  return { user, updateUser }
}

// Faked reading stats, tunable from Settings for demos. Not computed from anything.
export function useFakeStats() {
  const { accountId } = useAccount()
  const [stats, setStats] = useLocalStorage<FakeStats>(
    `fakeStats:${accountId}`,
    ACCOUNTS[accountId].stats,
  )
  const updateStats = useCallback(
    (partial: Partial<FakeStats>) => setStats((s) => ({ ...s, ...partial })),
    [setStats],
  )
  return { stats, updateStats }
}
