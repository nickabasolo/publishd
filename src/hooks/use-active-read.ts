import { useCallback } from 'react'
import { useLocalStorage } from '@/lib/storage'

export interface ActiveRead {
  slug: string
  chapterNumber: number
  completed: boolean
}

/**
 * The chapter the reader is currently partway through. Set when a chapter is
 * opened; cleared to `completed` when they reach the end (or dismiss the bar).
 * Starts empty — nothing to resume until you actually open something.
 */
export function useActiveRead() {
  const [activeRead, setActiveRead] = useLocalStorage<ActiveRead | null>('activeRead', null)

  // Opening a chapter makes it the active read. Re-opening the same chapter keeps
  // its state (so a finished chapter doesn't resurrect the bar); any other
  // chapter replaces it as a fresh in-progress read.
  const startChapter = useCallback(
    (slug: string, chapterNumber: number) => {
      setActiveRead((cur) =>
        cur && cur.slug === slug && cur.chapterNumber === chapterNumber
          ? cur
          : { slug, chapterNumber, completed: false },
      )
    },
    [setActiveRead],
  )

  const completeChapter = useCallback(
    (slug: string, chapterNumber: number) => {
      setActiveRead((cur) =>
        cur && cur.slug === slug && cur.chapterNumber === chapterNumber && !cur.completed
          ? { ...cur, completed: true }
          : cur,
      )
    },
    [setActiveRead],
  )

  // Dismissing the bar retires whatever is active, without navigating.
  const dismiss = useCallback(() => {
    setActiveRead((cur) => (cur && !cur.completed ? { ...cur, completed: true } : cur))
  }, [setActiveRead])

  return { activeRead, startChapter, completeChapter, dismiss }
}
