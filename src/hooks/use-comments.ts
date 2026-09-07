import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataClient } from '@/lib/data'
import type { AuthoredComment, ChapterCommentCounts, Comment, Page } from '@/lib/data'

export function chapterAnchor(slug: string, chapter: number): string {
  return `${slug}/${chapter}`
}
export function paragraphAnchor(slug: string, chapter: number, paragraph: number): string {
  return `${slug}/${chapter}/${paragraph}`
}

export interface ParsedAnchor {
  slug: string
  chapter: number
  paragraph?: number
}
export function parseAnchor(anchor: string): ParsedAnchor {
  const [slug, chapter, paragraph] = anchor.split('/')
  return {
    slug,
    chapter: Number(chapter),
    paragraph: paragraph === undefined ? undefined : Number(paragraph),
  }
}

export type { AuthoredComment }

/** One comment thread (chapter- or paragraph-level), keyed by anchor. */
export function useComments(anchor: string) {
  const client = useDataClient()
  const qc = useQueryClient()
  const key = ['comments', 'thread', anchor] as const

  const query = useQuery({
    queryKey: key,
    queryFn: () => client.comments.list(anchor, { limit: 200 }),
    enabled: Boolean(anchor),
  })
  const comments: Comment[] = query.data?.items ?? []

  const addComment = useMutation({
    mutationFn: (body: string) => client.comments.add(anchor, body),
    onSuccess: (comment) => {
      qc.setQueryData<Page<Comment>>(key, (old) =>
        old ? { ...old, items: [...old.items, comment] } : { items: [comment], nextCursor: null },
      )
    },
  })

  const addReply = useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      client.comments.reply(commentId, body),
    onSuccess: (reply, { commentId }) => {
      qc.setQueryData<Page<Comment>>(key, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((c) =>
                c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c,
              ),
            }
          : old,
      )
    },
  })

  const add = useCallback(
    (body: string) => {
      const text = body.trim()
      if (text) addComment.mutate(text)
    },
    [addComment],
  )
  const reply = useCallback(
    (commentId: string, body: string) => {
      const text = body.trim()
      if (text) addReply.mutate({ commentId, body: text })
    },
    [addReply],
  )

  return { comments, isLoading: query.isLoading, addComment: add, addReply: reply }
}

/** Comment counts (chapter total + per-paragraph) for one chapter, in a single batched call. */
export function useChapterCommentCounts(slug: string, chapterNumber: number) {
  const client = useDataClient()
  const query = useQuery({
    queryKey: ['comments', 'counts', slug, chapterNumber] as const,
    queryFn: () => client.comments.countsForChapter(slug, chapterNumber),
    enabled: Boolean(slug) && Number.isFinite(chapterNumber),
  })
  const counts: ChapterCommentCounts = query.data ?? { chapter: 0, paragraphs: {} }
  return counts
}

/** Every comment/reply authored by `handle`, newest first (bounded — see the contract's Page rule). */
export function useMyComments(handle: string) {
  const client = useDataClient()
  const query = useQuery({
    queryKey: ['comments', 'mine', handle] as const,
    queryFn: () => client.comments.mine(handle, { limit: 50 }),
    enabled: Boolean(handle),
  })
  return query.data?.items ?? []
}
