import { useCallback } from 'react'
import { useLocalStorage } from '@/lib/storage'
import { useUser } from '@/hooks/use-user'
import { COMMENT_SEED } from '@/data/comments-seed'
import type { Comment, CommentAuthor, CommentReply } from '@/lib/types'

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

export interface AuthoredComment {
  body: string
  at: number
  anchor: string
  isReply: boolean
}

function uid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

// Only the reader's own contributions are persisted; COMMENT_SEED stays an
// in-memory baseline so edits to it always show up (no cache-busting needed).
interface UserComments {
  comments: Record<string, Comment[]> // top-level comments, by anchor
  replies: Record<string, CommentReply[]> // replies, by parent comment id (seed or user)
}

const EMPTY: UserComments = { comments: {}, replies: {} }

/** Fake, localStorage-backed comments keyed by chapter/paragraph anchor. */
export function useComments() {
  const [store, setStore] = useLocalStorage<UserComments>('comments.v2', EMPTY)
  const { user } = useUser()

  const me = useCallback(
    (): CommentAuthor => ({
      name: user.displayName,
      handle: user.username,
      avatarColor: user.avatarColor,
    }),
    [user],
  )

  const list = useCallback(
    (anchor: string): Comment[] => {
      const base = [...(COMMENT_SEED[anchor] ?? []), ...(store.comments[anchor] ?? [])]
      return base.map((c) => ({
        ...c,
        replies: [...c.replies, ...(store.replies[c.id] ?? [])],
      }))
    },
    [store],
  )

  // Top-level comments + replies.
  const count = useCallback(
    (anchor: string) => list(anchor).reduce((n, c) => n + 1 + c.replies.length, 0),
    [list],
  )

  // Every comment/reply authored by `handle`, across all anchors (seed + user).
  const mine = useCallback(
    (handle: string): AuthoredComment[] => {
      const anchors = new Set([
        ...Object.keys(COMMENT_SEED),
        ...Object.keys(store.comments),
      ])
      const out: AuthoredComment[] = []
      for (const anchor of anchors) {
        for (const c of list(anchor)) {
          if (c.author.handle === handle) {
            out.push({ body: c.body, at: c.createdAt, anchor, isReply: false })
          }
          for (const r of c.replies) {
            if (r.author.handle === handle) {
              out.push({ body: r.body, at: r.createdAt, anchor, isReply: true })
            }
          }
        }
      }
      return out
    },
    [store, list],
  )

  const addComment = useCallback(
    (anchor: string, body: string) => {
      const text = body.trim()
      if (!text) return
      const comment: Comment = {
        id: uid(),
        author: me(),
        body: text,
        createdAt: Date.now(),
        replies: [],
      }
      setStore((s) => ({
        ...s,
        comments: { ...s.comments, [anchor]: [...(s.comments[anchor] ?? []), comment] },
      }))
    },
    [me, setStore],
  )

  const addReply = useCallback(
    (_anchor: string, commentId: string, body: string) => {
      const text = body.trim()
      if (!text) return
      const reply: CommentReply = { id: uid(), author: me(), body: text, createdAt: Date.now() }
      setStore((s) => ({
        ...s,
        replies: { ...s.replies, [commentId]: [...(s.replies[commentId] ?? []), reply] },
      }))
    },
    [me, setStore],
  )

  return { list, count, mine, addComment, addReply }
}
