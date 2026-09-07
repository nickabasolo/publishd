import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { StateBadge } from '@/components/studio/state-badge'
import { formatRelativeFuture } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ChapterState, StudioChapter } from '@/data/studio'

interface Props {
  slug: string
  chapter: StudioChapter
  onSetState: (state: ChapterState) => void
  onSetPaywall: (locked: boolean) => void
  onSchedule: () => void
  onDelete: () => void
}

const actionCls =
  'font-sans text-xs font-medium text-ink-soft transition-colors hover:text-ink dark:text-stone-400 dark:hover:text-stone-200'

export function ChapterRow({
  slug,
  chapter,
  onSetState,
  onSetPaywall,
  onSchedule,
  onDelete,
}: Props) {
  return (
    <div className="border-b border-ink/10 py-3 last:border-b-0 dark:border-white/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-5 shrink-0 text-right font-sans text-sm tabular-nums text-ink-soft dark:text-stone-500">
          {chapter.number}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/studio/${slug}/${chapter.id}`}
            className="font-serif text-base leading-snug text-ink hover:underline dark:text-stone-100"
          >
            {chapter.title || 'Untitled chapter'}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-sans text-xs text-ink-soft dark:text-stone-400">
            <span>{chapter.wordCount.toLocaleString()} words</span>
            {chapter.state === 'scheduled' && chapter.scheduledAt && (
              <span>· releases {formatRelativeFuture(chapter.scheduledAt)}</span>
            )}
            {chapter.locked && (
              <span className="inline-flex items-center gap-1">
                · <Lock className="h-3 w-3" /> Premium
              </span>
            )}
          </p>
        </div>
        <StateBadge state={chapter.state} className="mt-0.5 shrink-0" />
      </div>

      <div className="ml-8 mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Link to={`/studio/${slug}/${chapter.id}`} className={actionCls}>
          Edit
        </Link>
        {chapter.state === 'published' ? (
          <button type="button" className={actionCls} onClick={() => onSetState('draft')}>
            Unpublish
          </button>
        ) : (
          <button
            type="button"
            className={actionCls}
            onClick={() => onSetState('published')}
          >
            Publish
          </button>
        )}
        <button type="button" className={actionCls} onClick={onSchedule}>
          {chapter.state === 'scheduled' ? 'Reschedule' : 'Schedule'}
        </button>
        <button
          type="button"
          className={cn(actionCls, chapter.locked && 'text-ink dark:text-stone-200')}
          onClick={() => onSetPaywall(!chapter.locked)}
        >
          {chapter.locked ? 'Remove paywall' : 'Paywall'}
        </button>
        <button
          type="button"
          className={cn(actionCls, 'hover:text-rose-500 dark:hover:text-rose-400')}
          onClick={() => {
            if (window.confirm(`Delete "${chapter.title || 'Untitled chapter'}"?`)) onDelete()
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
