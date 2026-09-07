import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataClient } from '@/lib/data'
import { likedStorySlugs } from '@/data/demo-state'

const KEY = ['likes', 'story', 'mine'] as const

/** Liked stories, backed by the data contract. Drives the Likes tab and the heart controls. */
export function useLikes() {
  const client = useDataClient()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => client.likes.story.mine(),
    placeholderData: likedStorySlugs,
  })
  const liked = query.data ?? likedStorySlugs

  const has = useCallback((slug: string) => liked.includes(slug), [liked])

  const mutation = useMutation({
    mutationFn: (slug: string) => client.likes.story.toggle(slug),
    onMutate: async (slug) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<string[]>(KEY) ?? liked
      qc.setQueryData<string[]>(
        KEY,
        prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
      )
      return { prev }
    },
    onError: (_err, _slug, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
  })

  const toggle = useCallback((slug: string) => mutation.mutate(slug), [mutation])

  return { liked, has, toggle }
}
