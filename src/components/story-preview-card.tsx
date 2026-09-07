import { Link, useNavigate } from 'react-router-dom'
import { Eye, MessageCircle } from 'lucide-react'
import { LikeButton } from '@/components/like-button'
import { UserLink } from '@/components/user-link'
import { TagLink } from '@/components/tag-link'
import { useLikes } from '@/hooks/use-likes'
import { formatCompact, formatRelativeTime } from '@/lib/format'
import type { Story } from '@/lib/types'

const VISIBLE_TAGS = 7

function latestReadableChapter(story: Story) {
  const readable = story.chapters.filter((c) => !c.locked)
  return readable[readable.length - 1] ?? story.chapters[0]
}

export function StoryPreviewCard({ story }: { story: Story }) {
  const navigate = useNavigate()
  const likes = useLikes()

  const chapter = latestReadableChapter(story)
  const totalLabel = story.status === 'complete' ? story.chapters.length : '?'
  const shownTags = story.tags.slice(0, VISIBLE_TAGS)
  const moreCount = story.tags.length - shownTags.length
  const totalWords = story.chapters.reduce((n, c) => n + c.wordCount, 0)

  const open = () => navigate(`/read/${story.slug}/${chapter.number}`)

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open()
      }}
      className="flex cursor-pointer flex-col items-start rounded-2xl border border-ink/10 bg-paper p-5 text-ink shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-night dark:text-stone-200"
    >
      {/* Byline */}
      <div className="flex w-full items-center gap-2 font-sans text-sm tracking-[-0.15px]">
        <UserLink
          handle={story.author.handle}
          name={story.author.name}
          avatarColor={story.author.avatarColor}
          size={36}
          stopPropagation
        />
        <span className="text-ink-soft dark:text-stone-400">
          • {formatRelativeTime(story.updatedAt)}
        </span>
      </div>

      {/* Chapter title */}
      <h3 className="mt-4 font-serif text-2xl leading-tight">{chapter.title}</h3>

      {/* Chapter · work */}
      <div className="mt-1 flex w-full flex-wrap items-center gap-1 text-sm">
        <span className="font-sans tracking-[-0.15px] opacity-80">
          Chapter {chapter.number} of {totalLabel} in
        </span>
        <Link
          to={`/s/${story.slug}`}
          onClick={(e) => e.stopPropagation()}
          className="font-serif hover:underline"
        >
          {story.title}
        </Link>
      </div>

      {/* Tags */}
      <div className="mt-4 flex w-full flex-wrap items-start gap-x-2 gap-y-1">
        {shownTags.map((tag) => (
          <TagLink key={tag} tag={tag} stopPropagation />
        ))}
        {moreCount > 0 && (
          <span className="font-sans text-sm tracking-[-0.15px] text-ink-soft dark:text-stone-400">
            +{moreCount} more...
          </span>
        )}
      </div>

      {/* Excerpt of the latest chapter */}
      <div className="relative mt-4 max-h-[26rem] w-full overflow-hidden">
        <div className="space-y-4 font-serif text-sm leading-[23px]">
          {chapter.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-paper dark:to-night" />
      </div>

      {/* Stats */}
      <div className="mt-3 flex w-full items-center gap-1.5 pt-3 opacity-80">
        {/* Present but hidden in the current Figma spec — bump opacity to surface it */}
        <span className="font-sans text-sm tracking-[-0.15px] opacity-0">
          {totalWords.toLocaleString()} words • {story.chapters.length} / {totalLabel} chapters
        </span>
        <div className="ml-auto flex items-center gap-3 font-sans text-sm">
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
    </article>
  )
}
