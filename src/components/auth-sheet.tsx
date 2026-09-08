import { useEffect, useState, type ReactElement } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OAuthProvider } from '@/lib/data/supabase/auth'

interface Props {
  open: boolean
  action?: string
  onClose: () => void
  /** Called with the provider that was clicked. Ignored (any provider signs in the same fake reader) on the local backend. */
  onSignIn: (provider: OAuthProvider) => void
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8l4.1-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.2 6.6l4.1 3.1C6.2 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.8 1.3 10.3.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.8 1.4 0 2.3-1.3 3.2-2.6.6-.9.9-1.4 1.4-2.4-3.6-1.4-3.2-6.4-.7-7.9ZM14.1 4.4c.7-.9 1.2-2.1 1-3.4-1 .1-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.2 1.1.1 2.3-.6 3.1-1.4Z" />
    </svg>
  )
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#5865F2"
        d="M20.3 4.5A19 19 0 0 0 15.6 3l-.3.6a17 17 0 0 1 4.1 1.3 15.9 15.9 0 0 0-13-.1A16.6 16.6 0 0 1 8.6 3.5L8.3 3a19 19 0 0 0-4.6 1.5C1 8.6.2 12.6.6 16.5a19.2 19.2 0 0 0 5.8 2.9l.7-1.2c-.6-.2-1.2-.5-1.8-.9l.4-.3a13.6 13.6 0 0 0 11.6 0l.4.3c-.6.4-1.2.7-1.8.9l.7 1.2a19.1 19.1 0 0 0 5.8-2.9c.5-4.6-.8-8.5-2.7-12Zm-11.9 9.6c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Zm7.2 0c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Z"
      />
    </svg>
  )
}

const PROVIDERS: { id: OAuthProvider | 'apple'; name: string; Mark: () => ReactElement; disabled?: boolean }[] = [
  { id: 'google', name: 'Google', Mark: GoogleMark },
  { id: 'apple', name: 'Apple', Mark: AppleMark, disabled: true },
  { id: 'discord', name: 'Discord', Mark: DiscordMark },
]

export function AuthSheet({ open, action, onClose, onSignIn }: Props) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const id = requestAnimationFrame(() => setEntered(true))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/40 transition-opacity',
          entered ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        role="dialog"
        aria-label="Sign in"
        className={cn(
          'absolute inset-x-0 bottom-0 mx-auto flex max-w-[420px] flex-col rounded-t-2xl bg-paper p-5 text-ink shadow-xl transition-transform duration-300 dark:bg-night dark:text-stone-200',
          entered ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-sans text-lg font-semibold">
              Sign in{action ? ` to ${action}` : ''}
            </h2>
            <p className="mt-1 font-sans text-sm text-ink-soft dark:text-stone-400">
              You can keep browsing as a guest.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink-soft hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {PROVIDERS.map(({ id, name, Mark, disabled }) => (
            <button
              key={id}
              type="button"
              disabled={disabled}
              title={disabled ? 'Coming soon' : undefined}
              onClick={() => !disabled && onSignIn(id as OAuthProvider)}
              className={cn(
                'flex w-full items-center justify-center gap-2.5 rounded-md border border-ink/20 px-4 py-2.5 font-sans text-sm font-medium hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/5',
                disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent',
              )}
            >
              <Mark />
              Continue with {name}
              {disabled && (
                <span className="ml-1 rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-medium text-ink-soft dark:bg-white/10 dark:text-stone-400">
                  Coming soon
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
