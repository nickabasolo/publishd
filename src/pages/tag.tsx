import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { StoryPreviewCard } from '@/components/story-preview-card'
import { getStoriesByTag } from '@/data'
import { analytics } from '@/lib/analytics/events'

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

  useEffect(() => {
    if (tag) analytics.tagViewed(tag)
  }, [tag])

  if (!tag) return <Navigate to="/" replace />

  const results = getStoriesByTag(tag)

  return (
    <div className="mx-auto w-full max-w-[800px] pb-32 md:pb-24">
      <header className="px-5 pb-6 pt-10">
        <h1 className="font-sans text-3xl font-semibold tracking-[-0.15px]">#{tag}</h1>
        <p className="mt-1 font-sans text-sm text-ink-soft dark:text-stone-400">
          {results.length} {results.length === 1 ? 'story' : 'stories'}
        </p>
      </header>

      {results.length === 0 ? (
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
