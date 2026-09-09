import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  List,
  MessageCircle,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserLink } from '@/components/user-link'
import { TagLink } from '@/components/tag-link'
import { LikeButton } from '@/components/like-button'
import { CommentThread } from '@/components/comment-thread'
import { ParagraphCommentSheet } from '@/components/paragraph-comment-sheet'
import { useLikes } from '@/hooks/use-likes'
import { useReadingProgress } from '@/hooks/use-reading-progress'
import { chapterAnchor, useChapterCommentCounts } from '@/hooks/use-comments'
import { useParagraphLikes } from '@/hooks/use-paragraph-likes'
import { FONT_SIZE_CLASS, LINE_HEIGHT_CLASS, useSettings } from '@/context/settings'
import { formatCompact, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Chapter, Story } from '@/lib/types'

interface ReadingViewProps {
  story: Story
  chapter: Chapter
  onOpenChapters: () => void
}

function adjacentUnlocked(story: Story, from: number, dir: -1 | 1): Chapter | undefined {
  for (let n = from + dir; n >= 1 && n <= story.chapters.length; n += dir) {
    const ch = story.chapters.find((c) => c.number === n)
    if (ch && !ch.locked) return ch
  }
  return undefined
}

export function ReadingView({ story, chapter, onOpenChapters }: ReadingViewProps) {
  const navigate = useNavigate()
  const likes = useLikes()
  const { settings } = useSettings()
  const { completeChapter } = useReadingProgress(story.slug)
  const commentCounts = useChapterCommentCounts(story.slug, chapter.number)
  const paraLikes = useParagraphLikes(story.slug, chapter.number)
  const [activePara, setActivePara] = useState<number | null>(null)

  const viewportRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)

  // "Complete" = the reader actually scrolled AND the bottom of the last
  // paragraph has come into view. A chapter that fits on screen without
  // scrolling stays in-progress until the reader scrolls.
  useEffect(() => {
    scrolledRef.current = false
    const vp = viewportRef.current
    if (!vp) return
    const onScroll = () => {
      if (vp.scrollTop > 16) scrolledRef.current = true
      if (!scrolledRef.current) return
      const end = endRef.current
      if (!end) return
      if (end.getBoundingClientRect().bottom <= vp.getBoundingClientRect().bottom + 8) {
        completeChapter(chapter.number)
      }
    }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => vp.removeEventListener('scroll', onScroll)
  }, [story.slug, chapter.number, completeChapter])

  const prev = adjacentUnlocked(story, chapter.number, -1)
  const next = adjacentUnlocked(story, chapter.number, 1)
  const isLastWritten = chapter.number === story.chapters.filter((c) => !c.locked).length
  const totalLabel = story.status === 'complete' ? story.chapters.length : '?'

  return (
    <div className="h-full w-full bg-paper pb-20 text-ink md:pb-0 dark:bg-night dark:text-stone-200">
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        {/* Nav bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink/10 bg-paper/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
          <Link
            to="/"
            className="flex items-center gap-1.5 font-sans text-sm tracking-[-0.15px] opacity-70 hover:opacity-100"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Feed</span>
          </Link>
          <button
            type="button"
            onClick={onOpenChapters}
            className="flex items-center gap-1.5 border border-ink/25 px-3 py-1.5 font-sans text-sm tracking-[-0.15px] hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/5"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Chapters</span>
          </button>
        </div>

        <div className="mx-auto max-w-[800px] p-5">
          {/* Metadata — mirrors the preview card */}
          <div className="flex w-full items-center gap-2 font-sans text-sm tracking-[-0.15px]">
            <UserLink
              handle={story.author.handle}
              name={story.author.name}
              avatarColor={story.author.avatarColor}
              size={36}
            />
            <span className="text-ink-soft dark:text-stone-400">
              • {formatRelativeTime(story.updatedAt)}
            </span>
          </div>

          <h1 className="mt-4 font-serif text-2xl leading-tight">{chapter.title}</h1>

          <div className="mt-1 flex w-full flex-wrap items-center gap-1 text-sm">
            <span className="font-sans tracking-[-0.15px] opacity-80">
              Chapter {chapter.number} of {totalLabel} in
            </span>
            <Link to={`/s/${story.publicId}`} className="font-serif hover:underline">
              {story.title}
            </Link>
          </div>

          <div className="mt-4 flex w-full flex-wrap items-start gap-x-2 gap-y-1">
            {story.tags.map((tag) => (
              <TagLink key={tag} tag={tag} />
            ))}
          </div>

          <div className="mt-4 flex w-full items-center gap-4 font-sans text-sm opacity-80">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
              {formatCompact(story.stats.hits)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
              {formatCompact(story.stats.comments)}
            </span>
            <LikeButton
              liked={likes.has(story.slug)}
              count={story.stats.likes}
              onToggle={() => likes.toggle(story.slug)}
            />
          </div>

          <hr className="my-6 border-ink/10 dark:border-white/10" />

          {/* Chapter body — every paragraph is tappable to comment / like */}
          <div
            className={cn(
              'space-y-2 font-serif',
              FONT_SIZE_CLASS[settings.fontSize],
              LINE_HEIGHT_CLASS[settings.lineHeight],
            )}
          >
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
                            <MessageCircle
                              className="h-3 w-3 translate-y-[0.15em]"
                              strokeWidth={1.5}
                            />
                            {cCount}
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
          <div ref={endRef} aria-hidden />

          {isLastWritten && story.status === 'ongoing' && (
            <div className="mt-10 border border-dashed border-ink/20 p-6 text-center font-sans text-sm opacity-70 dark:border-white/20">
              You&rsquo;re all caught up. New chapters of <span className="font-serif">{story.title}</span>{' '}
              are released on a schedule.
            </div>
          )}

          {/* End-of-chapter comments */}
          <section className="mt-10 border-t border-ink/10 pt-6 dark:border-white/10">
            <h2 className="font-sans text-sm font-semibold">
              Comments
              {commentCounts.chapter > 0 && ` (${commentCounts.chapter})`}
            </h2>
            <div className="mt-4">
              <CommentThread anchor={chapterAnchor(story.slug, chapter.number)} />
            </div>
          </section>

          {/* Prev / Next */}
          <div className="mt-10 flex items-center justify-between gap-3 border-t border-ink/10 pt-6 font-sans text-sm dark:border-white/10">
            <button
              type="button"
              className="flex items-center gap-1.5 disabled:opacity-30"
              disabled={!prev}
              onClick={() => prev && navigate(`/read/${story.publicId}/${prev.number}`)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 disabled:opacity-30"
              disabled={!next}
              onClick={() => next && navigate(`/read/${story.publicId}/${next.number}`)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </ScrollArea>

      <ParagraphCommentSheet
        story={story}
        chapter={chapter}
        paragraphIndex={activePara}
        onClose={() => setActivePara(null)}
      />
    </div>
  )
}
