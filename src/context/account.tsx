import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocalStorage } from '@/lib/storage'
import type { AccountId } from '@/data/accounts'
import { onAuthStateChange } from '@/lib/data/supabase/auth'
import { supabase } from '@/lib/data/supabase/supabase-browser'
import { identifyUser, resetIdentity } from '@/lib/analytics/posthog'

interface AccountValue {
  accountId: AccountId
  setAccountId: (id: AccountId) => void
}

const AccountContext = createContext<AccountValue | null>(null)

const backend = import.meta.env.VITE_DATA_BACKEND ?? 'local'

/**
 * `VITE_DATA_BACKEND=local`: unchanged — a fake, freely-switchable persona
 * stored in localStorage (see the Prototype banner).
 */
function useLocalAccount(): AccountValue {
  const [accountId, setAccountId] = useLocalStorage<AccountId>('account', 'guest')
  return useMemo(() => ({ accountId, setAccountId }), [accountId, setAccountId])
}

/**
 * `VITE_DATA_BACKEND=supabase`: `accountId` derives from the real Supabase
 * session instead of localStorage — 'guest' when signed out, 'author' when
 * the signed-in profile has `is_author`, 'reader' otherwise. There is no
 * real-identity equivalent of the prototype's persona switcher, so
 * `setAccountId` is a no-op here: the only way to change identity is to sign
 * in (src/context/auth-prompt.tsx) or sign out.
 */
function useSupabaseAccount(): AccountValue {
  const [accountId, setAccountIdState] = useState<AccountId>('guest')

  useEffect(() => {
    let cancelled = false
    const unsubscribe = onAuthStateChange((session) => {
      if (!session) {
        if (!cancelled) setAccountIdState('guest')
        resetIdentity()
        return
      }
      // Users are identified by profile_id UUID only — never email/handle
      // (see the plan's instrumentation hard rule).
      identifyUser(session.user.id)
      supabase
        .from('profiles')
        .select('is_author')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setAccountIdState(data?.is_author ? 'author' : 'reader')
        })
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return useMemo(
    () => ({
      accountId,
      setAccountId: () => {
        console.warn(
          '[account] setAccountId is a no-op on the supabase backend — sign in or out to change identity.',
        )
      },
    }),
    [accountId],
  )
}

export function AccountProvider({ children }: { children: ReactNode }) {
  // Two hooks, chosen by a build-time env var rather than called
  // conditionally — `backend` never changes within a running app, so this
  // never violates the rules of hooks in practice.
  const value = backend === 'supabase' ? useSupabaseAccount() : useLocalAccount() // eslint-disable-line react-hooks/rules-of-hooks
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within AccountProvider')
  return ctx
}
