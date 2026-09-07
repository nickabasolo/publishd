import { FlaskConical } from 'lucide-react'
import { Segmented } from '@/components/ui/segmented'
import { useAccount } from '@/context/account'
import { useUser } from '@/hooks/use-user'
import type { AccountId } from '@/data/accounts'

const OPTIONS = [
  { value: 'guest' as AccountId, label: 'Guest' },
  { value: 'reader' as AccountId, label: 'Reader' },
  { value: 'author' as AccountId, label: 'Author' },
]

// Warm-gray diagonal "construction" stripes — signals this is a prototyping tool.
const STRIPES =
  'repeating-linear-gradient(45deg, rgba(120,113,108,0.22) 0 9px, rgba(120,113,108,0) 9px 22px)'

export function PrototypeBanner() {
  const { accountId, setAccountId } = useAccount()
  const { user } = useUser()

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between border-b border-ink/10 bg-surface px-4 dark:border-white/10 dark:bg-surface-night"
      style={{ backgroundImage: STRIPES }}
    >
      <div className="flex items-center gap-2 bg-surface/90 px-2 py-1 font-sans text-xs font-medium text-ink-soft backdrop-blur-sm dark:bg-surface-night/90 dark:text-stone-400">
        <FlaskConical className="h-4 w-4" />
        <span>Publishd · Prototype</span>
      </div>
      <div className="flex items-center gap-2 bg-surface/90 px-2 py-1 backdrop-blur-sm dark:bg-surface-night/90">
        <span className="hidden font-sans text-xs text-ink-soft sm:inline dark:text-stone-400">
          {accountId === 'guest' ? 'Browsing as guest' : `Signed in as ${user.displayName}`}
        </span>
        <Segmented
          aria-label="Prototype account"
          size="sm"
          options={OPTIONS}
          value={accountId}
          onChange={setAccountId}
        />
      </div>
    </div>
  )
}
