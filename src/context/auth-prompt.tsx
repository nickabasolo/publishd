import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AuthSheet } from '@/components/auth-sheet'
import { useAccount } from '@/context/account'
import { signInWithOAuth, type OAuthProvider } from '@/lib/data/supabase/auth'

interface PromptOpts {
  /** e.g. "like this", "comment", "follow Mara" — completes "Sign in to …". */
  action?: string
  /** Re-run after a successful (fake) sign-in. Only safe for identity-independent actions. */
  onComplete?: () => void
}

interface AuthPromptValue {
  isGuest: boolean
  promptAuth: (opts?: PromptOpts) => void
}

const AuthPromptContext = createContext<AuthPromptValue | null>(null)

const backend = import.meta.env.VITE_DATA_BACKEND ?? 'local'

export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const { accountId, setAccountId } = useAccount()
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<string | undefined>(undefined)
  const onCompleteRef = useRef<(() => void) | undefined>(undefined)

  const promptAuth = useCallback((opts?: PromptOpts) => {
    setAction(opts?.action)
    onCompleteRef.current = opts?.onComplete
    setOpen(true)
  }, [])

  // Local backend: the fake, instant sign-in the prototype always had.
  // Provider is ignored — every button does the same thing.
  const handleLocalSignIn = useCallback(() => {
    setAccountId('reader')
    setOpen(false)
    const cb = onCompleteRef.current
    onCompleteRef.current = undefined
    if (cb) requestAnimationFrame(cb)
  }, [setAccountId])

  // Supabase backend: real OAuth. This navigates the browser away to the
  // provider and back — there is no synchronous "signed in" moment here, so
  // `onComplete` cannot be safely replayed after a redirect round trip and
  // is intentionally not invoked. account.tsx's session listener picks up
  // the resulting session once the redirect returns.
  const handleOAuthSignIn = useCallback(async (provider: OAuthProvider) => {
    await signInWithOAuth(provider)
  }, [])

  const value = useMemo<AuthPromptValue>(
    () => ({ isGuest: accountId === 'guest', promptAuth }),
    [accountId, promptAuth],
  )

  return (
    <AuthPromptContext.Provider value={value}>
      {children}
      <AuthSheet
        open={open}
        action={action}
        onClose={() => setOpen(false)}
        onSignIn={backend === 'supabase' ? handleOAuthSignIn : handleLocalSignIn}
      />
    </AuthPromptContext.Provider>
  )
}

export function useAuthPrompt() {
  const ctx = useContext(AuthPromptContext)
  if (!ctx) throw new Error('useAuthPrompt must be used within AuthPromptProvider')
  return ctx
}
