import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataClient } from '@/lib/data'
import { paragraphAnchor } from '@/hooks/use-comments'
import { analytics } from '@/lib/analytics/events'

type ChapterLikes = Record<number, { liked: boolean; total: number }>

/**
 * Likes on individual paragraphs within one chapter, fetched in a single
 * batched call (`likes.paragraph.forChapter`) rather than one per paragraph.
 * Scoped by story/chapter so the reading view and the paragraph comment sheet
 * share the same cached data instead of re-fetching it.
 */
export function useParagraphLikes(slug: string, chapterNumber: number) {
  const client = useDataClient()
  const qc = useQueryClient()
  const key = ['likes', 'paragraph', slug, chapterNumber] as const

  const query = useQuery({
    queryKey: key,
    queryFn: () => client.likes.paragraph.forChapter(slug, chapterNumber),
    enabled: Boolean(slug) && Number.isFinite(chapterNumber),
  })
  const data: ChapterLikes = query.data ?? {}

  const has = useCallback((index: number) => data[index]?.liked ?? false, [data])
  const totalLikes = useCallback((index: number) => data[index]?.total ?? 0, [data])
  // Seed baseline, excluding the reader's own like (matches the paragraph sheet's LikeButton).
  const baseLikes = useCallback(
    (index: number) => {
      const entry = data[index]
      if (!entry) return 0
      return entry.total - (entry.liked ? 1 : 0)
    },
    [data],
  )

  const mutation = useMutation({
    mutationFn: (index: number) => client.likes.paragraph.toggle(paragraphAnchor(slug, chapterNumber, index)),
    onMutate: async (index) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<ChapterLikes>(key) ?? data
      const cur = prev[index] ?? { liked: false, total: 0 }
      qc.setQueryData<ChapterLikes>(key, {
        ...prev,
        [index]: { liked: !cur.liked, total: cur.total + (cur.liked ? -1 : 1) },
      })
      return { prev, wasLiked: cur.liked }
    },
    onError: (_err, _index, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSuccess: (_data, _index, ctx) => {
      // Taxonomy has no "paragraph_unliked" — only the like moment is
      // interesting for engagement tracking.
      if (!ctx?.wasLiked) analytics.paragraphLiked(slug, String(chapterNumber))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['likes', 'paragraph', 'mine'] })
    },
  })

  const toggle = useCallback((index: number) => mutation.mutate(index), [mutation])

  return { has, totalLikes, baseLikes, toggle }
}

/** Every paragraph anchor the caller has liked, across all stories — for the profile activity feed. */
export function useMyParagraphLikes() {
  const client = useDataClient()
  const query = useQuery({
    queryKey: ['likes', 'paragraph', 'mine'] as const,
    queryFn: () => client.likes.paragraph.mine(),
  })
  return query.data ?? []
}
