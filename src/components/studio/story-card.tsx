import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { chapterCounts, type StudioStory } from '@/data/studio'

export function StudioStoryCard({ story }: { story: StudioStory }) {
  const counts = chapterCounts(story)
  const parts = [
    counts.published && `${counts.published} published`,
    counts.scheduled && `${counts.scheduled} scheduled`,
    counts.draft && `${counts.draft} draft`,
  ].filter(Boolean)

  return (
    <Link
      to={`/studio/${story.slug}`}
      className="flex items-center gap-4 rounded-xl bg-paper px-5 py-4 shadow-sm transition-colors hover:bg-paper/70 dark:bg-night dark:hover:bg-night/70"
    >
      <div
        className="h-11 w-1.5 shrink-0 rounded"
        style={{ backgroundColor: story.coverColor }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-lg leading-tight text-ink dark:text-stone-100">
          {story.title}
        </p>
        <p className="mt-0.5 truncate font-sans text-sm text-ink-soft dark:text-stone-400">
          {story.status === 'complete' ? 'Complete' : 'Ongoing'}
          {parts.length > 0 && <> · {parts.join(' · ')}</>}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" />
    </Link>
  )
}
