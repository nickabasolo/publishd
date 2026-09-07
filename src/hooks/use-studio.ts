import { useCallback, useEffect } from 'react'
import { useLocalStorage } from '@/lib/storage'
import { useUser } from '@/hooks/use-user'
import {
  STUDIO_VERSION,
  countWords,
  studioBaseline,
  type ChapterState,
  type StudioChapter,
  type StudioStory,
} from '@/data/studio'

interface Snapshot {
  v: number
  stories: StudioStory[]
}

const EMPTY_SNAPSHOT: Snapshot = { v: 0, stories: [] }

function uid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

/**
 * Self-contained authoring store. Seeded once per author handle from
 * `studioBaseline`, then freely mutated. A STUDIO_VERSION bump re-seeds
 * (discarding edits) so seed changes always take effect.
 */
export function useStudio() {
  const { user } = useUser()
  const handle = user.username
  const [snap, setSnap] = useLocalStorage<Snapshot>(`studio:${handle}`, EMPTY_SNAPSHOT)

  const fresh = snap.v === STUDIO_VERSION
  const stories = fresh ? snap.stories : studioBaseline(handle)

  useEffect(() => {
    if (!fresh) setSnap({ v: STUDIO_VERSION, stories: studioBaseline(handle) })
  }, [fresh, handle, setSnap])

  const apply = useCallback(
    (fn: (list: StudioStory[]) => StudioStory[]) => {
      setSnap((s) => ({
        v: STUDIO_VERSION,
        stories: fn(s.v === STUDIO_VERSION ? s.stories : studioBaseline(handle)),
      }))
    },
    [handle, setSnap],
  )

  const getStudioStory = useCallback(
    (slug: string) => stories.find((s) => s.slug === slug),
    [stories],
  )

  const createStory = useCallback((): string => {
    const slug = `draft-${uid().slice(0, 8)}`
    apply((list) => [
      {
        slug,
        title: 'Untitled story',
        blurb: '',
        synopsis: '',
        tags: [],
        coverColor: '#6366f1',
        status: 'ongoing',
        chapters: [],
        isNew: true,
      },
      ...list,
    ])
    return slug
  }, [apply])

  const updateStory = useCallback(
    (slug: string, patch: Partial<StudioStory>) => {
      apply((list) => list.map((s) => (s.slug === slug ? { ...s, ...patch } : s)))
    },
    [apply],
  )

  const mutateChapter = useCallback(
    (slug: string, chId: string, fn: (c: StudioChapter) => StudioChapter) => {
      apply((list) =>
        list.map((s) =>
          s.slug === slug
            ? { ...s, chapters: s.chapters.map((c) => (c.id === chId ? fn(c) : c)) }
            : s,
        ),
      )
    },
    [apply],
  )

  const addChapter = useCallback(
    (slug: string): string => {
      const id = uid()
      apply((list) =>
        list.map((s) =>
          s.slug === slug
            ? {
                ...s,
                chapters: [
                  ...s.chapters,
                  {
                    id,
                    number: s.chapters.length + 1,
                    title: 'Untitled chapter',
                    body: '',
                    state: 'draft' as ChapterState,
                    locked: false,
                    wordCount: 0,
                  },
                ],
              }
            : s,
        ),
      )
      return id
    },
    [apply],
  )

  const updateChapter = useCallback(
    (slug: string, chId: string, patch: Partial<StudioChapter>) => {
      mutateChapter(slug, chId, (c) => {
        const next = { ...c, ...patch }
        if (patch.body !== undefined) next.wordCount = countWords(patch.body)
        return next
      })
    },
    [mutateChapter],
  )

  const setChapterState = useCallback(
    (slug: string, chId: string, state: ChapterState) => {
      mutateChapter(slug, chId, (c) => ({
        ...c,
        state,
        scheduledAt: state === 'scheduled' ? c.scheduledAt : undefined,
      }))
    },
    [mutateChapter],
  )

  const scheduleChapter = useCallback(
    (slug: string, chId: string, at: number) => {
      mutateChapter(slug, chId, (c) => ({ ...c, state: 'scheduled', scheduledAt: at }))
    },
    [mutateChapter],
  )

  const setPaywall = useCallback(
    (slug: string, chId: string, locked: boolean) => {
      mutateChapter(slug, chId, (c) => ({ ...c, locked }))
    },
    [mutateChapter],
  )

  const deleteChapter = useCallback(
    (slug: string, chId: string) => {
      apply((list) =>
        list.map((s) =>
          s.slug === slug
            ? {
                ...s,
                chapters: s.chapters
                  .filter((c) => c.id !== chId)
                  .map((c, i) => ({ ...c, number: i + 1 })),
              }
            : s,
        ),
      )
    },
    [apply],
  )

  return {
    stories,
    getStudioStory,
    createStory,
    updateStory,
    addChapter,
    updateChapter,
    setChapterState,
    scheduleChapter,
    setPaywall,
    deleteChapter,
  }
}
