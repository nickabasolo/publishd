import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { StoryPreviewCard } from '@/components/story-preview-card'
import { Segmented } from '@/components/ui/segmented'
import { Loading } from '@/components/ui/loading'
import { useFollows } from '@/hooks/use-follows'
import { useDataClient } from '@/lib/data'
import { toLegacyStory } from '@/lib/data/adapt'
import { analytics } from '@/lib/analytics/events'

type Tab = 'discover' | 'following'

const FEED_LIMIT = 50

export function HomePage() {
  const navigate = useNavigate()
  const client = useDataClient()
  const follows = useFollows()
  const [tab, setTab] = useState<Tab>('discover')

  const query = useQuery({
    queryKey: ['stories', 'feed', tab, tab === 'following' ? follows.following : null],
    queryFn: () =>
      client.stories.feed({
        limit: FEED_LIMIT,
        following: tab === 'following' ? follows.following : undefined,
      }),
  })
  const feed = (query.data?.items ?? []).map(toLegacyStory)
  const isLoading = query.isLoading

  useEffect(() => {
    if (!isLoading) analytics.feedViewed(tab, feed.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, feed.length, isLoading])

  return (
    <div className="mx-auto w-full max-w-[800px] pb-32 md:pb-24">
      <header className="flex flex-col items-center px-5 pb-10 pt-14 text-center text-ink dark:text-stone-100">
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

      <div className="flex items-center justify-between px-4 pb-4 sm:px-5">
        <Segmented<Tab>
          aria-label="Feed"
          options={[
            { value: 'discover', label: 'Discover' },
            { value: 'following', label: 'Following' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <Link
          to="/search"
          aria-label="Search"
          className="rounded-md p-2 text-ink-soft hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/5"
        >
          <Search className="h-5 w-5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mx-4 sm:mx-5">
          <Loading />
        </div>
      ) : feed.length === 0 ? (
        <p className="mx-4 rounded-xl bg-paper p-8 text-center font-sans text-sm text-ink-soft shadow-sm dark:bg-night dark:text-stone-400 sm:mx-5">
          Follow authors or like stories to build your feed.{' '}
          <Link to="/search" className="font-medium text-ink underline dark:text-stone-200">
            Find something to read
          </Link>
        </p>
      ) : (
        <div className="space-y-3 px-2 sm:px-4">
          {feed.map((story) => (
            <StoryPreviewCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  )
}
