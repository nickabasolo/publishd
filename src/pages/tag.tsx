import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { StoryPreviewCard } from '@/components/story-preview-card'
import { Loading } from '@/components/ui/loading'
import { useDataClient } from '@/lib/data'
import { toLegacyStory } from '@/lib/data/adapt'
import { analytics } from '@/lib/analytics/events'

const TAG_RESULTS_LIMIT = 50

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function TagPage() {
  const { tag: raw = '' } = useParams()
  const tag = safeDecode(raw)
  const client = useDataClient()

  const query = useQuery({
    queryKey: ['stories', 'byTag', tag],
    queryFn: () => client.stories.byTag(tag, { limit: TAG_RESULTS_LIMIT }),
    enabled: Boolean(tag),
  })
  const results = (query.data?.items ?? []).map(toLegacyStory)
  const isLoading = query.isLoading

  useEffect(() => {
    if (tag) analytics.tagViewed(tag)
  }, [tag])

  if (!tag) return <Navigate to="/" replace />

  return (
    <div className="mx-auto w-full max-w-[800px] pb-32 md:pb-24">
      <header className="px-5 pb-6 pt-10">
        <h1 className="font-sans text-3xl font-semibold tracking-[-0.15px]">#{tag}</h1>
        {!isLoading && (
          <p className="mt-1 font-sans text-sm text-ink-soft dark:text-stone-400">
            {results.length} {results.length === 1 ? 'story' : 'stories'}
          </p>
        )}
      </header>

      {isLoading ? (
        <div className="mx-5">
          <Loading />
        </div>
      ) : results.length === 0 ? (
        <p className="mx-5 rounded-xl bg-paper p-8 text-center font-sans text-sm text-ink-soft shadow-sm dark:bg-night dark:text-stone-400">
          No stories tagged &ldquo;{tag}&rdquo;.
        </p>
      ) : (
        <div className="space-y-3 px-2 sm:px-4">
          {results.map((s) => (
            <StoryPreviewCard key={s.id} story={s} />
          ))}
        </div>
      )}
    </div>
  )
}
