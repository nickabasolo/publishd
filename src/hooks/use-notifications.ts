import { useCallback, useMemo } from 'react'
import { useLocalStorage } from '@/lib/storage'
import { useUser } from '@/hooks/use-user'
import { stories } from '@/data'
import {
  AUTHOR_NOTIFICATION_TYPES,
  NOTIFICATION_SEED,
  type Notification,
} from '@/data/notifications-seed'

export interface FeedNotification extends Notification {
  read: boolean
}

/**
 * Fake notification feed. Seed is an in-memory baseline; only per-id read state
 * is persisted (mirrors the comments pattern so seed edits always take effect).
 */
export function useNotifications() {
  const { user } = useUser()
  const [readIds, setReadIds] = useLocalStorage<string[]>('notifications.read', [])

  const isAuthor = useMemo(
    () => stories.some((s) => s.author.handle === user.username),
    [user.username],
  )

  const items = useMemo<FeedNotification[]>(() => {
    return NOTIFICATION_SEED.filter(
      (n) => isAuthor || !AUTHOR_NOTIFICATION_TYPES.includes(n.type),
    )
      .map((n) => ({ ...n, read: readIds.includes(n.id) }))
      .sort((a, b) => b.at - a.at)
  }, [isAuthor, readIds])

  const unreadCount = items.reduce((n, it) => n + (it.read ? 0 : 1), 0)

  const markRead = useCallback(
    (id: string) => setReadIds((cur) => (cur.includes(id) ? cur : [...cur, id])),
    [setReadIds],
  )

  const markAllRead = useCallback(
    () => setReadIds(NOTIFICATION_SEED.map((n) => n.id)),
    [setReadIds],
  )

  return { items, unreadCount, markRead, markAllRead }
}
