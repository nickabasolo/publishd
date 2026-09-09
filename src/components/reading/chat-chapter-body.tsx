import { Heart, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chapter, Story } from '@/lib/types'
import type { ChapterCommentCounts } from '@/lib/data'
import type { useParagraphLikes } from '@/hooks/use-paragraph-likes'

interface ChatChapterBodyProps {
  chapter: Chapter
  story: Story
  commentCounts: ChapterCommentCounts
  paraLikes: ReturnType<typeof useParagraphLikes>
  setActivePara: (index: number) => void
}

const FALLBACK_COLOR = '#6b7280'

export function ChatChapterBody({
  chapter,
  story,
  commentCounts,
  paraLikes,
  setActivePara,
}: ChatChapterBodyProps) {
  return (
    <>
      {chapter.paragraphs.map((p, i) => {
        const cCount = commentCounts.paragraphs[i] ?? 0
        const lTotal = paraLikes.totalLikes(i)
        const liked = paraLikes.has(i)
        const hasActivity = cCount > 0 || lTotal > 0
        const speaker = chapter.speakers?.[i]
        const isRight = speaker === 'b'
        const color = speaker
          ? story.chatParticipants?.[speaker]?.color ?? FALLBACK_COLOR
          : undefined

        if (!speaker) {
          // Defensive fallback — shouldn't happen for a real chat-format chapter.
          return (
            <div
              key={i}
              onClick={() => {
                if (!window.getSelection()?.toString()) setActivePara(i)
              }}
              className="-mx-2 cursor-pointer rounded px-2 py-1 transition-colors hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]"
            >
              <p>{p}</p>
            </div>
          )
        }

        return (
          <div key={i} className={cn('flex w-full', isRight ? 'justify-end' : 'justify-start')}>
            <div
              onClick={() => {
                if (!window.getSelection()?.toString()) setActivePara(i)
              }}
              className="max-w-[80%] cursor-pointer rounded-2xl px-3 py-2 text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: color }}
            >
              <p>
                {p}
                {hasActivity && (
                  <span className="ml-2 inline-flex items-baseline gap-2.5 whitespace-nowrap align-baseline font-sans text-xs text-white/80">
                    {lTotal > 0 && (
                      <span className="inline-flex items-baseline gap-1">
                        <Heart
                          className={cn(
                            'h-3 w-3 translate-y-[0.15em]',
                            liked && 'fill-rose-300 text-rose-300',
                          )}
                          strokeWidth={1.5}
                        />
                        {lTotal}
                      </span>
                    )}
                    {cCount > 0 && (
                      <span className="inline-flex items-baseline gap-1">
                        <MessageCircle className="h-3 w-3 translate-y-[0.15em]" strokeWidth={1.5} />
                        {cCount}
                      </span>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>
        )
      })}
    </>
  )
}
