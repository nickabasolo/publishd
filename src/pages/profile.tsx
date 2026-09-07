import { Link, useParams } from 'react-router-dom'
import { Settings as SettingsIcon } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatTile } from '@/components/stat-tile'
import { ActivityFeed } from '@/components/activity-feed'
import { useUser, useFakeStats } from '@/hooks/use-user'
import { useFollows } from '@/hooks/use-follows'
import { useComments } from '@/hooks/use-comments'
import { useLikes } from '@/hooks/use-likes'
import { useParagraphLikes } from '@/hooks/use-paragraph-likes'
import { getPerson, fakeStatsFor } from '@/data/people'
import { stories } from '@/data'
import { buildActivity, seededCommentsBy } from '@/lib/activity'

export function ProfilePage() {
  const { handle = '' } = useParams()
  const { user } = useUser()
  const { stats: myStats } = useFakeStats()
  const follows = useFollows()
  const comments = useComments()
  const likes = useLikes()
  const paraLikes = useParagraphLikes()

  const isSelf = handle === user.username

  const selfStorySlugs = stories
    .filter((s) => s.author.handle === user.username)
    .map((s) => s.slug)

  const person = isSelf
    ? {
        handle: user.username,
        name: user.displayName,
        avatarColor: user.avatarColor,
        bio: user.bio,
        isAuthor: selfStorySlugs.length > 0,
        storySlugs: selfStorySlugs,
      }
    : getPerson(handle)

  const stats = isSelf ? myStats : fakeStatsFor(handle)

  const activity = isSelf
    ? buildActivity({
        handle,
        isSelf: true,
        comments: comments.mine(handle),
        publishedSlugs: person.storySlugs,
        likedStorySlugs: likes.liked,
        likedParagraphAnchors: paraLikes.liked,
      })
    : buildActivity({
        handle,
        isSelf: false,
        comments: seededCommentsBy(handle),
        publishedSlugs: person.storySlugs,
      })

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
                onClick={() => follows.toggle(handle)}
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
