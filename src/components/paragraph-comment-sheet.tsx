import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { CommentThread } from '@/components/comment-thread'
import { LikeButton } from '@/components/like-button'
import { paragraphAnchor } from '@/hooks/use-comments'
import { useParagraphLikes } from '@/hooks/use-paragraph-likes'
import { cn } from '@/lib/utils'
import type { Chapter, Story } from '@/lib/types'

interface Props {
  story: Story
  chapter: Chapter
  paragraphIndex: number | null
  onClose: () => void
}

export function ParagraphCommentSheet({ story, chapter, paragraphIndex, onClose }: Props) {
  const paraLikes = useParagraphLikes()
  const open = paragraphIndex !== null
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const id = requestAnimationFrame(() => setEntered(true))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (paragraphIndex === null) return null

  const anchor = paragraphAnchor(story.slug, chapter.number, paragraphIndex)

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/40 transition-opacity',
          entered ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        role="dialog"
        aria-label="Paragraph comments"
        className={cn(
          'absolute inset-x-0 bottom-0 mx-auto flex max-h-[82vh] max-w-[520px] flex-col rounded-t-2xl bg-paper text-ink shadow-xl transition-transform duration-300 dark:bg-night dark:text-stone-200',
          entered ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ink/10 px-4 py-3 dark:border-white/10">
          <h2 className="font-sans text-sm font-semibold">Paragraph note</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink-soft hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <CommentThread
            anchor={anchor}
            quote={chapter.paragraphs[paragraphIndex]}
            likeSlot={
              <LikeButton
                liked={paraLikes.has(anchor)}
                count={paraLikes.baseLikes(anchor)}
                onToggle={() => paraLikes.toggle(anchor)}
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
