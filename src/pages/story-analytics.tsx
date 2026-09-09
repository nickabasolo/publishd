import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { StatTile } from '@/components/stat-tile'
import { BarChart } from '@/components/studio/bar-chart'
import { Loading } from '@/components/ui/loading'
import { useStudio } from '@/hooks/use-studio'
import { useDataClient } from '@/lib/data'
import { formatCompact } from '@/lib/format'
import { analytics } from '@/lib/analytics/events'

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(1, ...points)
  const min = Math.min(...points)
  const range = Math.max(1, max - min)
  const w = 100
  const h = 32
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / range) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function StoryAnalyticsPage() {
  const { slug = '' } = useParams()
  const studio = useStudio()
  const client = useDataClient()

  const story = studio.getStudioStory(slug)

  useEffect(() => {
    if (story) analytics.analyticsViewed(slug)
  }, [story, slug])

  const analyticsQuery = useQuery({
    queryKey: ['stories', 'analytics', slug],
    queryFn: () => client.stories.getAnalytics(slug),
    enabled: Boolean(story),
  })

  // Studio bookkeeping stays slug-keyed; the reader-facing "top passages"
  // links below need the public id, which the studio-story shape doesn't
  // carry (see `StudioStory.publicId`'s doc comment) — fetch it separately.
  const publicIdQuery = useQuery({
    queryKey: ['stories', 'bySlug', 'publicId', slug],
    queryFn: () => client.stories.getBySlug(slug),
    enabled: Boolean(story),
  })
  const publicId = publicIdQuery.data?.publicId ?? slug

  if (!story) return <Navigate to="/studio" replace />

  if (analyticsQuery.isLoading) {
    return (
      <div className="min-h-full bg-surface px-4 py-6 pb-32 dark:bg-surface-night md:py-10 md:pb-24">
        <div className="mx-auto max-w-2xl">
          <Loading />
        </div>
      </div>
    )
  }

  const a = analyticsQuery.data ?? {
    totalReads: 0,
    likes: 0,
    comments: 0,
    subscribers: 0,
    completionRate: 0,
    readsByChapter: [],
    readsLast30: [],
    topPassages: [],
  }

  return (
    <div className="min-h-full bg-surface px-4 py-6 pb-32 dark:bg-surface-night md:py-10 md:pb-24">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          to={`/studio/${slug}`}
          className="inline-flex items-center gap-1.5 font-sans text-sm text-ink-soft hover:text-ink dark:text-stone-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {story.title}
        </Link>

        <h1 className="font-sans text-2xl font-semibold tracking-[-0.15px]">Analytics</h1>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Reads" value={formatCompact(a.totalReads)} />
          <StatTile label="Likes" value={formatCompact(a.likes)} />
          <StatTile label="Comments" value={formatCompact(a.comments)} />
          <StatTile label="Subscribers" value={formatCompact(a.subscribers)} />
        </div>

        <section className="rounded-xl bg-paper p-5 shadow-sm dark:bg-night sm:p-6">
          <h2 className="mb-3 font-sans text-sm font-semibold">Reads by chapter</h2>
          <BarChart data={a.readsByChapter} />
          <p className="mt-3 font-sans text-xs text-ink-soft dark:text-stone-500">
            {Math.round(a.completionRate * 100)}% of readers who start finish the latest
            chapter.
          </p>
        </section>

        <section className="rounded-xl bg-paper p-5 shadow-sm dark:bg-night sm:p-6">
          <h2 className="mb-3 font-sans text-sm font-semibold">Reads · last 30 days</h2>
          <div className="text-ink/70 dark:text-stone-300/70">
            <Sparkline points={a.readsLast30} />
          </div>
        </section>

        <section className="rounded-xl bg-paper p-5 shadow-sm dark:bg-night sm:p-6">
          <h2 className="mb-3 font-sans text-sm font-semibold">Top passages</h2>
          <ul className="space-y-1">
            {a.topPassages.map((p, i) => (
              <li key={i}>
                <Link
                  to={`/read/${publicId}/${p.chapter}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 font-sans text-sm transition-colors hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <span className="text-ink dark:text-stone-200">
                    Chapter {p.chapter} · a passage
                  </span>
                  <span className="shrink-0 text-ink-soft dark:text-stone-400">
                    {p.likes} likes
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="font-sans text-xs text-ink-soft dark:text-stone-500">
          Reflects real reads, likes, comments and follows for this story.
        </p>
      </div>
    </div>
  )
}
