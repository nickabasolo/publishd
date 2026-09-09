import { Heart, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chapter } from '@/lib/types'
import type { ChapterCommentCounts } from '@/lib/data'
import type { useParagraphLikes } from '@/hooks/use-paragraph-likes'

interface ProseChapterBodyProps {
  chapter: Chapter
  commentCounts: ChapterCommentCounts
  paraLikes: ReturnType<typeof useParagraphLikes>
  setActivePara: (index: number) => void
}

export function ProseChapterBody({
  chapter,
  commentCounts,
  paraLikes,
  setActivePara,
}: ProseChapterBodyProps) {
  return (
    <>
      {chapter.paragraphs.map((p, i) => {
        const cCount = commentCounts.paragraphs[i] ?? 0
        const lTotal = paraLikes.totalLikes(i)
        const liked = paraLikes.has(i)
        const hasActivity = cCount > 0 || lTotal > 0
        return (
          <div
            key={i}
            onClick={() => {
              if (!window.getSelection()?.toString()) setActivePara(i)
            }}
            className="-mx-2 cursor-pointer rounded px-2 py-1 transition-colors hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]"
          >
            <p>
              {p}
              {hasActivity && (
                <span className="ml-2 inline-flex items-baseline gap-2.5 whitespace-nowrap align-baseline font-sans text-xs text-ink-soft dark:text-stone-400">
                  {lTotal > 0 && (
                    <span className="inline-flex items-baseline gap-1">
                      <Heart
                        className={cn(
                          'h-3 w-3 translate-y-[0.15em]',
                          liked && 'fill-rose-500 text-rose-500',
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
        )
      })}
    </>
  )
}
