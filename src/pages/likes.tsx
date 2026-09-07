import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { stories } from '@/data'
import { useLikes } from '@/hooks/use-likes'
import type { Story } from '@/lib/types'

function latestReadableChapter(story: Story) {
  const readable = story.chapters.filter((c) => !c.locked)
  return readable[readable.length - 1] ?? story.chapters[0]
}

function RowStatus({ story }: { story: Story }) {
  if (story.newChapters > 0) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 font-sans text-sm font-semibold text-ink dark:text-stone-100">
        {story.newChapters} new
        <span className="h-2 w-2 rounded-full bg-red-500" />
      </span>
    )
  }
  return (
    <span className="shrink-0 font-sans text-sm text-ink-soft dark:text-stone-400">
      {story.status === 'complete' ? 'Complete' : 'Caught up'}
    </span>
  )
}

function StoryRow({ story }: { story: Story }) {
  return (
    <Link
      to={`/read/${story.slug}/${latestReadableChapter(story).number}`}
      className="flex items-center gap-4 rounded-xl bg-paper px-5 py-4 shadow-sm transition-colors hover:bg-paper/70 dark:bg-night dark:hover:bg-night/70"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-xl leading-tight text-ink dark:text-stone-100">
          {story.title}
        </p>
        <p className="mt-0.5 truncate font-sans text-sm text-ink-soft dark:text-stone-400">
          @{story.author.handle}
        </p>
      </div>
      <RowStatus story={story} />
    </Link>
  )
}

export function LikesPage() {
  const { liked } = useLikes()
  const likedStories = stories.filter((s) => liked.includes(s.slug))

  return (
    <div className="px-4 py-6 pb-32 md:py-10 md:pb-24">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="font-sans text-3xl font-semibold tracking-[-0.15px]">Likes</h1>
          <p className="mt-1 font-sans text-sm text-ink-soft dark:text-stone-400">
            Stories you&rsquo;ve hearted.
          </p>
        </header>

        {likedStories.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-paper p-10 text-center font-sans text-sm text-ink-soft shadow-sm dark:bg-night dark:text-stone-400">
            <Heart className="h-6 w-6" strokeWidth={1.5} />
            Tap the heart on any story to save it here.
          </div>
        ) : (
          <div className="space-y-3">
            {likedStories.map((s) => (
              <StoryRow key={s.id} story={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
