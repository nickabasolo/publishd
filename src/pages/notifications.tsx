import { useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Heart,
  MessageCircle,
  TrendingUp,
  UserPlus,
} from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { useNotifications, type FeedNotification } from '@/hooks/use-notifications'
import { useAuthPrompt } from '@/context/auth-prompt'
import { getStory } from '@/data'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { NotificationType } from '@/lib/data'

const ICON: Record<NotificationType, typeof Bell> = {
  'new-chapter': BookOpen,
  'comment-reply': MessageCircle,
  'new-follower': UserPlus,
  'story-complete': CheckCircle2,
  'story-liked': Heart,
  'reads-milestone': TrendingUp,
}

function describe(n: FeedNotification): { text: string; href: string } {
  const actorHandle = n.actor?.handle ?? n.actorId
  const actor = actorHandle ? `@${actorHandle}` : 'Someone'
  const title = getStory(n.storySlug)?.title ?? 'a story'
  const chapterHref =
    n.storySlug && n.chapterNumber
      ? `/read/${n.storySlug}/${n.chapterNumber}`
      : n.storySlug
        ? `/s/${n.storySlug}`
        : '/'

  switch (n.type) {
    case 'new-chapter':
      return { text: `${actor} published Chapter ${n.chapterNumber} of “${title}”`, href: chapterHref }
    case 'comment-reply':
      return { text: `${actor} replied to your comment on “${title}”`, href: chapterHref }
    case 'new-follower':
      return { text: `${actor} started following you`, href: `/u/${actorHandle}` }
    case 'story-complete':
      return { text: `“${title}” is now complete`, href: `/s/${n.storySlug}` }
    case 'story-liked':
      return { text: `${actor} liked “${title}”`, href: `/s/${n.storySlug}` }
    case 'reads-milestone':
      return {
        text: `“${title}” passed ${(n.count ?? 0).toLocaleString()} reads`,
        href: n.storySlug ? `/studio/${n.storySlug}/analytics` : '/studio',
      }
    default:
      return { text: 'New activity', href: '/' }
  }
}

function GuestGate() {
  const { promptAuth } = useAuthPrompt()
  return (
    <div className="min-h-full bg-surface px-4 py-6 pb-32 dark:bg-surface-night md:py-10 md:pb-24">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-3 rounded-xl bg-paper p-10 text-center shadow-sm dark:bg-night">
          <Bell className="h-6 w-6 text-ink-soft" strokeWidth={1.5} />
          <p className="font-sans text-sm text-ink-soft dark:text-stone-400">
            Sign in to get notified about new chapters, replies, and followers.
          </p>
          <button
            type="button"
            onClick={() => promptAuth({ action: 'get notifications' })}
            className="bg-ink px-4 py-2 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const { isGuest } = useAuthPrompt()
  const { items, unreadCount, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()

  if (isGuest) return <GuestGate />

  return (
    <div className="min-h-full bg-surface px-4 py-6 pb-32 dark:bg-surface-night md:py-10 md:pb-24">
      <div className="mx-auto max-w-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="font-sans text-3xl font-semibold tracking-[-0.15px]">Notifications</h1>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="font-sans text-sm font-medium text-ink-soft hover:text-ink dark:text-stone-400"
            >
              Mark all read
            </button>
          )}
        </header>

        {items.length === 0 ? (
          <p className="rounded-xl bg-paper p-10 text-center font-sans text-sm text-ink-soft shadow-sm dark:bg-night dark:text-stone-400">
            Nothing new.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl bg-paper shadow-sm dark:bg-night">
            {items.map((n) => {
              const { text, href } = describe(n)
              const Icon = ICON[n.type]
              const person = n.actor
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markRead(n.id)
                      navigate(href)
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-ink/10 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-ink/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]',
                      !n.read && 'bg-ink/[0.02] dark:bg-white/[0.03]',
                    )}
                  >
                    <span className="relative mt-0.5 shrink-0">
                      {person ? (
                        <Avatar name={person.displayName} color={person.avatarColor} size={32} />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/[0.06] dark:bg-white/10">
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-sans text-sm text-ink dark:text-stone-200">
                        {text}
                      </span>
                      <span className="mt-0.5 block font-sans text-xs text-ink-soft dark:text-stone-500">
                        {formatRelativeTime(n.at)}
                      </span>
                    </span>
                    {!n.read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
