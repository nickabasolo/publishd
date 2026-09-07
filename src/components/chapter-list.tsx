import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Story } from '@/lib/types'

interface ChapterListProps {
  story: Story
  currentChapterNumber?: number
  /** When provided (in-reader drawer), rows are buttons; otherwise they are links. */
  onSelect?: (chapterNumber: number) => void
}

export function ChapterList({ story, currentChapterNumber, onSelect }: ChapterListProps) {
  return (
    <ul className="space-y-0.5 font-sans">
      {story.chapters.map((ch) => {
        const isCurrent = ch.number === currentChapterNumber

        if (ch.locked) {
          return (
            <li
              key={ch.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-ink-soft/60 dark:text-stone-600"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Lock className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {ch.number}. {ch.title}
                </span>
              </span>
              <Badge variant="muted" className="shrink-0">
                Premium
              </Badge>
            </li>
          )
        }

        const inner = (
          <>
            <span className="min-w-0 truncate">
              {ch.number}. {ch.title}
            </span>
            <span
              className={cn(
                'shrink-0 text-xs',
                isCurrent ? 'opacity-70' : 'text-ink-soft dark:text-stone-500',
              )}
            >
              {ch.wordCount.toLocaleString()} words
            </span>
          </>
        )

        const cls = cn(
          'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
          isCurrent
            ? 'bg-ink text-paper dark:bg-stone-100 dark:text-stone-900'
            : 'hover:bg-ink/5 dark:hover:bg-white/5',
        )

        return (
          <li key={ch.id}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(ch.number)} className={cls}>
                {inner}
              </button>
            ) : (
              <Link to={`/read/${story.slug}/${ch.number}`} className={cls}>
                {inner}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
