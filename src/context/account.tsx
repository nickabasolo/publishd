import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocalStorage } from '@/lib/storage'
import type { AccountId } from '@/data/accounts'

interface AccountValue {
  accountId: AccountId
  setAccountId: (id: AccountId) => void
}

const AccountContext = createContext<AccountValue | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountId] = useLocalStorage<AccountId>('account', 'reader')
  const value = useMemo(() => ({ accountId, setAccountId }), [accountId, setAccountId])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within AccountProvider')
  return ctx
}
