import { useNavigate } from 'react-router-dom'
import { Plus, PenLine } from 'lucide-react'
import { StudioStoryCard } from '@/components/studio/story-card'
import { useStudio } from '@/hooks/use-studio'
import { useAuthPrompt } from '@/context/auth-prompt'

export function StudioPage() {
  const navigate = useNavigate()
  const { stories, createStory } = useStudio()
  const { isGuest, promptAuth } = useAuthPrompt()

  const startStory = () => navigate(`/studio/${createStory()}`)

  if (isGuest) {
    return (
      <div className="min-h-full bg-surface px-4 py-6 pb-32 dark:bg-surface-night md:py-10 md:pb-24">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-paper p-10 text-center shadow-sm dark:bg-night">
            <PenLine className="h-6 w-6 text-ink-soft" strokeWidth={1.5} />
            <p className="font-sans text-sm text-ink-soft dark:text-stone-400">
              Sign in to start writing and publishing your own serialized fiction.
            </p>
            <button
              type="button"
              onClick={() => promptAuth({ action: 'start writing' })}
              className="bg-ink px-4 py-2 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-surface px-4 py-6 pb-32 dark:bg-surface-night md:py-10 md:pb-24">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-sans text-3xl font-semibold tracking-[-0.15px]">Your stories</h1>
            <p className="mt-1 font-sans text-sm text-ink-soft dark:text-stone-400">
              Draft, schedule, and publish serialized chapters.
            </p>
          </div>
          {stories.length > 0 && (
            <button
              type="button"
              onClick={startStory}
              className="inline-flex shrink-0 items-center gap-1.5 bg-ink px-3 py-2 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900"
            >
              <Plus className="h-4 w-4" />
              New story
            </button>
          )}
        </header>

        {stories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-paper p-10 text-center shadow-sm dark:bg-night">
            <PenLine className="h-6 w-6 text-ink-soft" strokeWidth={1.5} />
            <p className="font-sans text-sm text-ink-soft dark:text-stone-400">
              You haven&rsquo;t started a story yet.
            </p>
            <button
              type="button"
              onClick={startStory}
              className="bg-ink px-4 py-2 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900"
            >
              Start writing
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {stories.map((s) => (
              <StudioStoryCard key={s.slug} story={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
