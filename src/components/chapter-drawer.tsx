import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { UserLink } from '@/components/user-link'
import { cn } from '@/lib/utils'
import type { Story } from '@/lib/types'

interface ChapterDrawerProps {
  story: Story
  currentChapterNumber: number
  open: boolean
  onClose: () => void
}

export function ChapterDrawer({ story, currentChapterNumber, open, onClose }: ChapterDrawerProps) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className={cn('fixed inset-0 z-50', open ? '' : 'pointer-events-none')}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-label="Chapters"
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-paper text-ink shadow-xl transition-transform dark:bg-night dark:text-stone-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 p-4 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="truncate font-serif text-lg leading-tight">{story.title}</h2>
            <UserLink
              handle={story.author.handle}
              name={story.author.name}
              avatarColor={story.author.avatarColor}
              size={18}
              className="mt-1 font-sans text-sm text-ink-soft dark:text-stone-400"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chapters"
            className="p-1 text-ink-soft hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <p className="font-sans text-sm leading-[1.6] text-ink-soft dark:text-stone-400">
              {story.synopsis}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant={story.status === 'complete' ? 'default' : 'outline'}>
                {story.status === 'complete' ? 'Complete' : 'Ongoing'}
              </Badge>
              {story.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>

            <ul className="mt-5 space-y-0.5 font-sans">
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
                      <Badge variant="muted" className="shrink-0">Premium</Badge>
                    </li>
                  )
                }
                return (
                  <li key={ch.id}>
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/read/${story.slug}/${ch.number}`)
                        onClose()
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                        isCurrent
                          ? 'bg-ink text-paper dark:bg-stone-100 dark:text-stone-900'
                          : 'hover:bg-ink/5 dark:hover:bg-white/5',
                      )}
                    >
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
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
