import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataClient } from '@/lib/data'
import type { InProgressRead, Page, ReadingProgress } from '@/lib/data'
import { analytics } from '@/lib/analytics/events'

// Dwell time is only meaningful within one browser tab's lifetime — not
// persisted, not read anywhere authoritative (read_events in Postgres owns
// real reading-time analytics; this is purely for the PostHog property).
const chapterOpenedAt = new Map<string, number>()

const IN_PROGRESS_KEY = ['reading', 'inProgress'] as const

function progressKey(storyId: string) {
  return ['reading', 'progress', storyId] as const
}

/**
 * Per-story reading progress — replaces the old single global `activeRead`
 * record. Set when a chapter is opened; marked complete when the reader
 * reaches the end (or dismisses the now-reading bar).
 */
export function useReadingProgress(storyId: string) {
  const client = useDataClient()
  const qc = useQueryClient()
  const key = progressKey(storyId)

  const query = useQuery({
    queryKey: key,
    queryFn: () => client.reading.getProgress(storyId),
    enabled: Boolean(storyId),
  })
  const progress: ReadingProgress | null = query.data ?? null

  const onProgressSuccess = useCallback(
    (next: ReadingProgress) => {
      qc.setQueryData(key, next)
      qc.invalidateQueries({ queryKey: IN_PROGRESS_KEY })
    },
    [qc, key],
  )

  const startChapterMutation = useMutation({
    mutationFn: ({ chapterNumber }: { chapterNumber: number; source: string }) =>
      client.reading.startChapter(storyId, chapterNumber),
    onSuccess: (next, { chapterNumber, source }) => {
      onProgressSuccess(next)
      chapterOpenedAt.set(`${storyId}:${chapterNumber}`, Date.now())
      analytics.chapterOpened(storyId, String(chapterNumber), chapterNumber, source)
    },
  })
  const completeChapterMutation = useMutation({
    mutationFn: (chapterNumber: number) => client.reading.completeChapter(storyId, chapterNumber),
    onSuccess: (next, chapterNumber) => {
      onProgressSuccess(next)
      const openKey = `${storyId}:${chapterNumber}`
      const openedAt = chapterOpenedAt.get(openKey)
      const dwellSeconds = openedAt ? Math.round((Date.now() - openedAt) / 1000) : 0
      chapterOpenedAt.delete(openKey)
      analytics.chapterCompleted(storyId, String(chapterNumber), chapterNumber, dwellSeconds)
    },
  })
  const dismissMutation = useMutation({
    mutationFn: () => client.reading.dismiss(storyId),
    onSuccess: () => {
      qc.setQueryData<ReadingProgress | null>(key, (cur) => (cur ? { ...cur, completed: true } : cur))
      qc.invalidateQueries({ queryKey: IN_PROGRESS_KEY })
    },
  })

  const startChapterMutate = startChapterMutation.mutate
  const completeChapterMutate = completeChapterMutation.mutate
  const dismissMutate = dismissMutation.mutate

  const startChapter = useCallback(
    (chapterNumber: number, source = 'direct') => startChapterMutate({ chapterNumber, source }),
    [startChapterMutate],
  )
  const completeChapter = useCallback(
    (chapterNumber: number) => completeChapterMutate(chapterNumber),
    [completeChapterMutate],
  )
  const dismiss = useCallback(() => dismissMutate(), [dismissMutate])

  return { progress, startChapter, completeChapter, dismiss }
}

/** Every story with in-progress reading, most recently active first. */
export function useInProgressReads(): Page<InProgressRead> {
  const client = useDataClient()
  const query = useQuery({
    queryKey: IN_PROGRESS_KEY,
    queryFn: () => client.reading.inProgress({ limit: 50 }),
  })
  return query.data ?? { items: [], nextCursor: null }
}
