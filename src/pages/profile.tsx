import { Link, useParams } from 'react-router-dom'
import { Settings as SettingsIcon } from 'lucide-react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Avatar } from '@/components/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatTile } from '@/components/stat-tile'
import { ActivityFeed } from '@/components/activity-feed'
import { useUser, useFakeStats } from '@/hooks/use-user'
import { useFollows } from '@/hooks/use-follows'
import { useMyComments, parseAnchor } from '@/hooks/use-comments'
import { useLikes } from '@/hooks/use-likes'
import { useMyParagraphLikes } from '@/hooks/use-paragraph-likes'
import { useDataClient } from '@/lib/data'
import { buildActivity, type StoryLookup } from '@/lib/activity'
import { useAuthPrompt } from '@/context/auth-prompt'

export function ProfilePage() {
  const { handle = '' } = useParams()
  const { user } = useUser()
  const { stats: myStats } = useFakeStats()
  const follows = useFollows()
  const { isGuest, promptAuth } = useAuthPrompt()
  const myComments = useMyComments(handle)
  const likes = useLikes()
  const myParagraphLikes = useMyParagraphLikes()
  const client = useDataClient()

  const isSelf = handle === user.username

  const otherProfile = useQuery({
    queryKey: ['profiles', 'byHandle', handle],
    queryFn: () => client.profiles.getByHandle(handle),
    enabled: Boolean(handle) && !isSelf,
  })
  const otherStats = useQuery({
    queryKey: ['profiles', 'stats', handle],
    queryFn: () => client.profiles.getStats(handle),
    enabled: Boolean(handle) && !isSelf,
  })

  const isGuestSelf = isSelf && isGuest

  const selfStorySlugs = user.author?.publishedStoryIds ?? []

  const person = isSelf
    ? {
        handle: user.username,
        name: user.displayName,
        avatarColor: user.avatarColor,
        bio: user.bio,
        isAuthor: selfStorySlugs.length > 0,
        storySlugs: selfStorySlugs,
      }
    : {
        handle,
        name: otherProfile.data?.displayName ?? `@${handle}`,
        avatarColor: otherProfile.data?.avatarColor ?? '#94a3b8',
        bio: otherProfile.data?.bio ?? '',
        isAuthor: otherProfile.data?.isAuthor ?? false,
        storySlugs: otherProfile.data?.author?.publishedStoryIds ?? [],
      }

  const stats = isSelf
    ? myStats
    : (otherStats.data ?? { booksRead: 0, chaptersRead: 0, minutesRead: 0, dayStreak: 0 })

  // Every story slug referenced by the activity feed (comments, likes,
  // published stories) — fetched through the data contract, not the static
  // bundled demo data, so a real backend's content shows up here too.
  const activitySlugs = [
    ...new Set([
      ...myComments.map((c) => parseAnchor(c.anchor).slug),
      ...(isSelf ? likes.liked : []),
      ...(isSelf ? myParagraphLikes.map((a) => parseAnchor(a).slug) : []),
      ...person.storySlugs,
    ]),
  ]
  const activityStoryQueries = useQueries({
    queries: activitySlugs.map((slug) => ({
      queryKey: ['stories', 'bySlug', slug],
      queryFn: () => client.stories.getBySlug(slug),
    })),
  })
  const activityStories: StoryLookup = new Map()
  activitySlugs.forEach((slug, i) => {
    const s = activityStoryQueries[i]?.data
    if (s) activityStories.set(slug, s)
  })

  // Small pool of real stories to draw from so another person's empty feed
  // still shows something, instead of always the same static demo data.
  const fallbackFeed = useQuery({
    queryKey: ['stories', 'feed', 'activityFallback'],
    queryFn: () => client.stories.feed({ limit: 20 }),
    enabled: !isSelf,
  })

  const activity = isSelf
    ? buildActivity({
        handle,
        isSelf: true,
        comments: myComments,
        publishedSlugs: person.storySlugs,
        likedStorySlugs: likes.liked,
        likedParagraphAnchors: myParagraphLikes,
        stories: activityStories,
      })
    : buildActivity({
        handle,
        isSelf: false,
        comments: myComments,
        publishedSlugs: person.storySlugs,
        stories: activityStories,
        fallbackPool: fallbackFeed.data?.items,
      })

  if (isGuestSelf) {
    return (
      <div className="min-h-full bg-surface px-4 py-6 pb-32 dark:bg-surface-night md:py-10 md:pb-24">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-paper p-10 text-center shadow-sm dark:bg-night">
            <Avatar name="Guest" color="#94a3b8" size={64} />
            <p className="font-sans text-sm text-ink-soft dark:text-stone-400">
              You&rsquo;re browsing as a guest. Sign in to like, comment, follow, and build
              your profile.
            </p>
            <Button size="sm" onClick={() => promptAuth({ action: 'get started' })}>
              Sign in
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-surface px-4 py-6 pb-32 dark:bg-surface-night md:py-10 md:pb-24">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Identity */}
        <header className="flex flex-col items-center rounded-xl bg-paper p-6 text-center shadow-sm dark:bg-night">
          <Avatar name={person.name} color={person.avatarColor} size={72} />
          <h1 className="mt-3 font-sans text-2xl font-semibold tracking-[-0.15px]">
            {person.name}
          </h1>
          <p className="font-sans text-sm text-ink-soft dark:text-stone-400">@{person.handle}</p>

          {person.isAuthor && (
            <Badge variant="outline" className="mt-3">
              Author
            </Badge>
          )}

          {person.bio && (
            <p className="mt-3 max-w-md font-sans text-sm text-ink dark:text-stone-300">
              {person.bio}
            </p>
          )}

          {isSelf && user.favoriteGenres.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {user.favoriteGenres.map((g) => (
                <Badge key={g}>{g}</Badge>
              ))}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            {isSelf ? (
              <>
                <Link to="/settings">
                  <Button variant="outline" size="sm">
                    Edit profile
                  </Button>
                </Link>
                <Link to="/settings" aria-label="Settings">
                  <Button variant="outline" size="sm" className="px-2.5">
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            ) : (
              <Button
                size="sm"
                variant={follows.isFollowing(handle) ? 'outline' : 'default'}
                onClick={() =>
                  isGuest
                    ? promptAuth({
                        action: `follow @${handle}`,
                        onComplete: () => follows.toggle(handle),
                      })
                    : follows.toggle(handle)
                }
              >
                {follows.isFollowing(handle) ? 'Following' : 'Follow'}
              </Button>
            )}
          </div>

          {isSelf && person.isAuthor && (
            <Link
              to="/studio"
              className="mt-3 font-sans text-sm font-medium text-ink-soft hover:text-ink dark:text-stone-400"
            >
              Manage your stories →
            </Link>
          )}
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Books read" value={stats.booksRead} />
          <StatTile label="Chapters" value={stats.chaptersRead} />
          <StatTile label="Minutes" value={stats.minutesRead.toLocaleString()} />
          <StatTile label="Day streak" value={stats.dayStreak} />
        </div>

        {/* Activity */}
        <section className="rounded-xl bg-paper p-4 shadow-sm dark:bg-night sm:p-6">
          <h2 className="mb-3 font-sans text-sm font-semibold">Activity</h2>
          <ActivityFeed items={activity} />
        </section>
      </div>
    </div>
  )
}
