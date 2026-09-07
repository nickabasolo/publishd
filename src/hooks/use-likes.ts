import { useCallback } from 'react'
import { useLocalStorage } from '@/lib/storage'
import { likedStorySlugs } from '@/data/demo-state'

/** Liked stories, persisted. Drives the Likes tab and the heart controls. */
export function useLikes() {
  const [liked, setLiked] = useLocalStorage<string[]>('likes', likedStorySlugs)

  const has = useCallback((slug: string) => liked.includes(slug), [liked])

  const toggle = useCallback(
    (slug: string) =>
      setLiked((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug])),
    [setLiked],
  )

  return { liked, has, toggle }
}
