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
import { analytics } from '@/lib/analytics/events'

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
  // Tracks whether the open sheet ended in a sign-in, so closing it doesn't
  // also fire a "dismissed" event on top of "converted".
  const convertedRef = useRef(false)

  const promptAuth = useCallback((opts?: PromptOpts) => {
    setAction(opts?.action)
    onCompleteRef.current = opts?.onComplete
    convertedRef.current = false
    analytics.authPromptShown(opts?.action ?? 'unspecified')
    setOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    if (!convertedRef.current) analytics.authPromptDismissed(action ?? 'unspecified')
    setOpen(false)
  }, [action])

  // Local backend: the fake, instant sign-in the prototype always had.
  // Provider is ignored — every button does the same thing.
  const handleLocalSignIn = useCallback(() => {
    convertedRef.current = true
    analytics.authPromptConverted(action ?? 'unspecified', 'local')
    setAccountId('reader')
    setOpen(false)
    const cb = onCompleteRef.current
    onCompleteRef.current = undefined
    if (cb) requestAnimationFrame(cb)
  }, [setAccountId, action])

  // Supabase backend: real OAuth. This navigates the browser away to the
  // provider and back — there is no synchronous "signed in" moment here, so
  // `onComplete` cannot be safely replayed after a redirect round trip and
  // is intentionally not invoked. account.tsx's session listener picks up
  // the resulting session once the redirect returns.
  const handleOAuthSignIn = useCallback(
    async (provider: OAuthProvider) => {
      convertedRef.current = true
      analytics.authPromptConverted(action ?? 'unspecified', provider)
      analytics.signupStarted(provider)
      await signInWithOAuth(provider)
    },
    [action],
  )

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
        onClose={handleClose}
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
