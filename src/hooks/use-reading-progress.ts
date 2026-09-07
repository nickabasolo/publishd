import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataClient } from '@/lib/data'
import type { InProgressRead, Page, ReadingProgress } from '@/lib/data'

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
    mutationFn: (chapterNumber: number) => client.reading.startChapter(storyId, chapterNumber),
    onSuccess: onProgressSuccess,
  })
  const completeChapterMutation = useMutation({
    mutationFn: (chapterNumber: number) => client.reading.completeChapter(storyId, chapterNumber),
    onSuccess: onProgressSuccess,
  })
  const dismissMutation = useMutation({
    mutationFn: () => client.reading.dismiss(storyId),
    onSuccess: () => {
      qc.setQueryData<ReadingProgress | null>(key, (cur) => (cur ? { ...cur, completed: true } : cur))
      qc.invalidateQueries({ queryKey: IN_PROGRESS_KEY })
    },
  })

  const startChapter = useCallback(
    (chapterNumber: number) => startChapterMutation.mutate(chapterNumber),
    [startChapterMutation],
  )
  const completeChapter = useCallback(
    (chapterNumber: number) => completeChapterMutation.mutate(chapterNumber),
    [completeChapterMutation],
  )
  const dismiss = useCallback(() => dismissMutation.mutate(), [dismissMutation])

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
