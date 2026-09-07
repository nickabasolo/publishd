import { Link, Navigate, useParams } from 'react-router-dom'
import { Eye, MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { UserLink } from '@/components/user-link'
import { TagLink } from '@/components/tag-link'
import { ChapterList } from '@/components/chapter-list'
import { LikeButton } from '@/components/like-button'
import { useLikes } from '@/hooks/use-likes'
import { useReadingProgress } from '@/hooks/use-reading-progress'
import { getStory } from '@/data'
import { formatCompact, formatRelativeTime } from '@/lib/format'

export function StoryPage() {
  const { slug = '' } = useParams()
  const likes = useLikes()
  const { progress } = useReadingProgress(slug)

  const story = getStory(slug)
  if (!story) return <Navigate to="/" replace />

  const totalWords = story.chapters.reduce((n, c) => n + c.wordCount, 0)
  const firstUnlocked = story.chapters.find((c) => !c.locked) ?? story.chapters[0]
  const resume = progress && !progress.completed ? progress.chapterNumber : null
  const ctaChapter = resume ?? firstUnlocked.number

  return (
    <div className="min-h-full bg-surface px-4 py-6 pb-32 dark:bg-surface-night md:py-10 md:pb-24">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Header */}
        <header className="rounded-xl bg-paper p-5 shadow-sm dark:bg-night sm:p-6">
          <div className="flex items-start gap-4">
            <div
              className="h-14 w-2 shrink-0 rounded"
              style={{ backgroundColor: story.coverColor }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-3xl leading-tight">{story.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 font-sans text-sm text-ink-soft dark:text-stone-400">
                <UserLink
                  handle={story.author.handle}
                  name={story.author.name}
                  avatarColor={story.author.avatarColor}
                  size={22}
                />
                <span>· updated {formatRelativeTime(story.updatedAt)}</span>
              </div>
            </div>
          </div>

          <p className="mt-4 font-serif text-[15px] leading-[1.7] text-ink dark:text-stone-200">
            {story.synopsis}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant={story.status === 'complete' ? 'default' : 'outline'}>
              {story.status === 'complete' ? 'Complete' : 'Ongoing'}
            </Badge>
            {story.tags.map((tag) => (
              <TagLink key={tag} tag={tag} className="text-xs" />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link
              to={`/read/${story.slug}/${ctaChapter}`}
              className="bg-ink px-5 py-2.5 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900"
            >
              {resume ? `Continue · Chapter ${resume}` : 'Start reading'}
            </Link>
            <div className="flex items-center gap-4 font-sans text-sm text-ink-soft dark:text-stone-400">
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
          </div>
        </header>

        {/* Chapters */}
        <section className="rounded-xl bg-paper p-4 shadow-sm dark:bg-night sm:p-6">
          <h2 className="mb-3 font-sans text-sm font-semibold">
            Chapters
            <span className="ml-1.5 font-normal text-ink-soft dark:text-stone-500">
              {story.chapters.length} · {totalWords.toLocaleString()} words
            </span>
          </h2>
          <ChapterList story={story} />
        </section>
      </div>
    </div>
  )
}
