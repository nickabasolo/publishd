import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataClient } from '@/lib/data'
import { analytics } from '@/lib/analytics/events'

const KEY = ['follows', 'author', 'mine'] as const

/** Followed author handles, backed by the data contract. */
export function useFollows() {
  const client = useDataClient()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => client.follows.author.mine(),
    placeholderData: [] as string[],
  })
  const following = query.data ?? []

  const isFollowing = useCallback((handle: string) => following.includes(handle), [following])

  const mutation = useMutation({
    mutationFn: (handle: string) => client.follows.author.toggle(handle),
    onMutate: async (handle) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<string[]>(KEY) ?? following
      const wasFollowing = prev.includes(handle)
      qc.setQueryData<string[]>(KEY, wasFollowing ? prev.filter((h) => h !== handle) : [...prev, handle])
      return { prev, wasFollowing }
    },
    onError: (_err, _handle, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
    onSuccess: (_data, handle, ctx) => {
      if (ctx?.wasFollowing) analytics.authorUnfollowed(handle)
      else analytics.authorFollowed(handle)
    },
  })

  const toggle = useCallback((handle: string) => mutation.mutate(handle), [mutation])

  return { following, isFollowing, toggle }
}
