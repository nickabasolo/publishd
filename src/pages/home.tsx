import { useNavigate } from 'react-router-dom'
import { StoryPreviewCard } from '@/components/story-preview-card'
import { stories } from '@/data'

// Most recently updated first — the serialized-fiction sort.
const feed = [...stories].sort(
  (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
)

export function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-[800px] pb-32 md:pb-24">
      <header className="flex flex-col items-center px-5 pb-16 pt-14 text-center text-ink dark:text-stone-100">
        <h1 className="font-wordmark text-5xl">publishd.</h1>
        <p className="mt-4 max-w-md font-sans text-lg leading-relaxed text-ink-soft dark:text-stone-400">
          We&rsquo;re building a community where authors own their work and earn their worth.
          Read new stories, join the conversation, and directly support the creators you love.
        </p>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="border border-ink/25 px-5 py-2.5 font-sans text-sm font-medium hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/5"
          >
            Learn more
          </button>
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="bg-ink px-5 py-2.5 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-100/90"
          >
            Post a chapter
          </button>
        </div>
      </header>

      <div className="space-y-3 px-2 sm:px-4">
        {feed.map((story) => (
          <StoryPreviewCard key={story.id} story={story} />
        ))}
      </div>
    </div>
  )
}
