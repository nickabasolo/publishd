import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataClient } from '@/lib/data'
import type { Notification, Page } from '@/lib/data'

export type { Notification }
export type FeedNotification = Notification

const LIST_KEY = ['notifications', 'list'] as const
const COUNT_KEY = ['notifications', 'unreadCount'] as const

export function useNotifications() {
  const client = useDataClient()
  const qc = useQueryClient()

  const listQuery = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => client.notifications.list({ limit: 200 }),
  })
  const items = listQuery.data?.items ?? []

  const countQuery = useQuery({
    queryKey: COUNT_KEY,
    queryFn: () => client.notifications.unreadCount(),
  })
  const unreadCount = countQuery.data ?? 0

  const markReadMutation = useMutation({
    mutationFn: (id: string) => client.notifications.markRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: LIST_KEY })
      const prevList = qc.getQueryData<Page<Notification>>(LIST_KEY)
      const prevCount = qc.getQueryData<number>(COUNT_KEY)
      if (prevList) {
        qc.setQueryData<Page<Notification>>(LIST_KEY, {
          ...prevList,
          items: prevList.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })
      }
      const wasUnread = prevList?.items.find((n) => n.id === id)?.read === false
      if (wasUnread && prevCount !== undefined) qc.setQueryData(COUNT_KEY, Math.max(0, prevCount - 1))
      return { prevList, prevCount }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prevList) qc.setQueryData(LIST_KEY, ctx.prevList)
      if (ctx?.prevCount !== undefined) qc.setQueryData(COUNT_KEY, ctx.prevCount)
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => client.notifications.markAllRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: LIST_KEY })
      const prevList = qc.getQueryData<Page<Notification>>(LIST_KEY)
      const prevCount = qc.getQueryData<number>(COUNT_KEY)
      if (prevList) {
        qc.setQueryData<Page<Notification>>(LIST_KEY, {
          ...prevList,
          items: prevList.items.map((n) => ({ ...n, read: true })),
        })
      }
      qc.setQueryData(COUNT_KEY, 0)
      return { prevList, prevCount }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevList) qc.setQueryData(LIST_KEY, ctx.prevList)
      if (ctx?.prevCount !== undefined) qc.setQueryData(COUNT_KEY, ctx.prevCount)
    },
  })

  const markRead = useCallback((id: string) => markReadMutation.mutate(id), [markReadMutation])
  const markAllRead = useCallback(() => markAllReadMutation.mutate(), [markAllReadMutation])

  return { items, unreadCount, markRead, markAllRead }
}
