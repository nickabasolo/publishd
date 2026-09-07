import { useCallback } from 'react'
import { useLocalStorage } from '@/lib/storage'

/** Fake, persisted follow list keyed by user handle. */
export function useFollows() {
  const [following, setFollowing] = useLocalStorage<string[]>('follows', [])

  const isFollowing = useCallback(
    (handle: string) => following.includes(handle),
    [following],
  )

  const toggle = useCallback(
    (handle: string) =>
      setFollowing((cur) =>
        cur.includes(handle) ? cur.filter((h) => h !== handle) : [...cur, handle],
      ),
    [setFollowing],
  )

  return { following, isFollowing, toggle }
}
