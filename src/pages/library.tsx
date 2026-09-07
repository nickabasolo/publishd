import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { stories } from '@/data'
import { useLikes } from '@/hooks/use-likes'
import { useInProgressReads } from '@/hooks/use-reading-progress'
import { useAuthPrompt } from '@/context/auth-prompt'
import { analytics } from '@/lib/analytics/events'
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

function StoryRow({
  story,
  to,
  trailing,
  onClick,
}: {
  story: Story
  to: string
  trailing?: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
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
      {trailing ?? <RowStatus story={story} />}
    </Link>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft dark:text-stone-500">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function LibraryPage() {
  const { liked } = useLikes()
  const { items: inProgress } = useInProgressReads()
  const { isGuest, promptAuth } = useAuthPrompt()

  // The join'd `story` comes from the data contract's Story shape, which is
  // structurally compatible with the legacy `Story` this page otherwise uses.
  const readingRows = inProgress
    .filter((p) => p.story)
    .map((p) => ({ story: stories.find((s) => s.slug === p.storyId) ?? null, chapterNumber: p.chapterNumber }))
    .filter((r): r is { story: Story; chapterNumber: number } => Boolean(r.story))

  const likedStories = stories.filter((s) => liked.includes(s.slug))

  return (
    <div className="px-4 py-6 pb-32 md:py-10 md:pb-24">
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <h1 className="font-sans text-3xl font-semibold tracking-[-0.15px]">Library</h1>
          <p className="mt-1 font-sans text-sm text-ink-soft dark:text-stone-400">
            Stories you&rsquo;re reading and stories you&rsquo;ve saved.
          </p>
        </header>

        <Section title="Currently reading">
          {readingRows.length === 0 ? (
            <p className="rounded-xl bg-paper p-8 text-center font-sans text-sm text-ink-soft shadow-sm dark:bg-night dark:text-stone-400">
              Open a chapter and it&rsquo;ll show up here.
            </p>
          ) : (
            <div className="space-y-3">
              {readingRows.map(({ story, chapterNumber }) => (
                <StoryRow
                  key={story.id}
                  story={story}
                  to={`/read/${story.slug}/${chapterNumber}`}
                  onClick={() => analytics.readingResumed(story.slug, 'library')}
                  trailing={
                    <span className="shrink-0 font-sans text-sm font-medium text-ink dark:text-stone-100">
                      Continue · Ch {chapterNumber}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </Section>

        <Section title="Liked">
          {isGuest ? (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-paper p-8 text-center shadow-sm dark:bg-night">
              <Heart className="h-6 w-6 text-ink-soft" strokeWidth={1.5} />
              <p className="font-sans text-sm text-ink-soft dark:text-stone-400">
                Sign in to save stories to your library.
              </p>
              <button
                type="button"
                onClick={() => promptAuth({ action: 'save stories' })}
                className="bg-ink px-4 py-2 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900"
              >
                Sign in
              </button>
            </div>
          ) : likedStories.length === 0 ? (
            <p className="rounded-xl bg-paper p-8 text-center font-sans text-sm text-ink-soft shadow-sm dark:bg-night dark:text-stone-400">
              Tap the heart on any story to save it here.
            </p>
          ) : (
            <div className="space-y-3">
              {likedStories.map((s) => (
                <StoryRow key={s.id} story={s} to={`/read/${s.slug}/${latestReadableChapter(s).number}`} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
