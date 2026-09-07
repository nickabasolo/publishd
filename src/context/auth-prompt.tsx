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

  const handleSignIn = useCallback(() => {
    setAccountId('reader')
    setOpen(false)
    const cb = onCompleteRef.current
    onCompleteRef.current = undefined
    if (cb) requestAnimationFrame(cb)
  }, [setAccountId])

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
        onSignIn={handleSignIn}
      />
    </AuthPromptContext.Provider>
  )
}

export function useAuthPrompt() {
  const ctx = useContext(AuthPromptContext)
  if (!ctx) throw new Error('useAuthPrompt must be used within AuthPromptProvider')
  return ctx
}
