import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useInProgressReads, useReadingProgress } from '@/hooks/use-reading-progress'
import { cn } from '@/lib/utils'
import { analytics } from '@/lib/analytics/events'

/**
 * "Now reading" bar (à la Spotify's now-playing). Appears only when the reader is
 * partway through a chapter and not currently in the reader; tapping it resumes,
 * the ✕ retires it. Reaching the end of a chapter clears it too.
 */
export function NowReadingBar() {
  const { items } = useInProgressReads()
  // Most recently active in-progress read — there's normally only one anyway.
  const top = items[0]
  const { dismiss } = useReadingProgress(top?.storyId ?? '')
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [entered, setEntered] = useState(false)

  const inReader = pathname.startsWith('/read/')
  const story = top?.story
  const visible = Boolean(top) && Boolean(story) && !inReader

  useEffect(() => {
    if (!visible) {
      setEntered(false)
      return
    }
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [visible])

  if (!visible || !top || !story) return null

  const chapter = story.chapters.find((c) => c.number === top.chapterNumber)
  const target = `/read/${story.slug}/${top.chapterNumber}`

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-16 z-40 flex items-center gap-2 border-t border-ink/10 bg-paper/95 px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur transition-all duration-300 md:bottom-0 md:left-64 dark:border-white/10 dark:bg-night/95',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
      )}
    >
      <button
        type="button"
        onClick={() => {
          analytics.readingResumed(story.slug, 'now_reading_bar')
          navigate(target)
        }}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className="h-9 w-9 shrink-0"
          style={{ backgroundColor: story.coverColor }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-sm text-ink dark:text-stone-100">
            {story.title}
          </span>
          <span className="block truncate font-sans text-xs text-ink-soft dark:text-stone-400">
            Chapter {top.chapterNumber}
            {chapter ? ` · ${chapter.title}` : ''}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss now reading"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
