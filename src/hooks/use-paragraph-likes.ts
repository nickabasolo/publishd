import { useCallback } from 'react'
import { useLocalStorage } from '@/lib/storage'
import { PARAGRAPH_LIKE_SEED } from '@/data/comments-seed'

/** Likes on individual paragraphs, keyed by paragraph anchor. */
export function useParagraphLikes() {
  const [liked, setLiked] = useLocalStorage<string[]>('paragraphLikes', [])

  const has = useCallback((key: string) => liked.includes(key), [liked])

  const toggle = useCallback(
    (key: string) =>
      setLiked((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])),
    [setLiked],
  )

  // Seed baseline; the reader's own like adds +1 on top (matches LikeButton).
  const baseLikes = useCallback((key: string) => PARAGRAPH_LIKE_SEED[key] ?? 0, [])

  const totalLikes = useCallback(
    (key: string) => baseLikes(key) + (liked.includes(key) ? 1 : 0),
    [baseLikes, liked],
  )

  return { liked, has, toggle, baseLikes, totalLikes }
}
