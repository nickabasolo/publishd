import { cn } from '@/lib/utils'
import type { ChapterState } from '@/data/studio'

const STYLES: Record<ChapterState, string> = {
  draft: 'bg-ink/[0.06] text-ink-soft dark:bg-white/10 dark:text-stone-300',
  scheduled:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  published:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}

const LABELS: Record<ChapterState, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
}

export function StateBadge({ state, className }: { state: ChapterState; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 font-sans text-xs font-medium',
        STYLES[state],
        className,
      )}
    >
      {LABELS[state]}
    </span>
  )
}
