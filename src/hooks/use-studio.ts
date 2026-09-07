import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataClient } from '@/lib/data'
import { useAccount } from '@/context/account'
import { countWords, type ChapterState, type StudioChapter, type StudioStory } from '@/data/studio'
import { analytics } from '@/lib/analytics/events'
import { throttled } from '@/lib/analytics/throttle'

function uid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

/**
 * Self-contained authoring store, backed by the data contract's `studio`
 * segment. Every mutation updates the cached story list optimistically
 * (mirroring the old synchronous reducer) so typing in the editor and
 * toggling chapter state never waits on a round trip.
 */
export function useStudio() {
  const client = useDataClient()
  const qc = useQueryClient()
  const { accountId } = useAccount()
  const key = ['studio', 'mine', accountId] as const

  const query = useQuery({
    queryKey: key,
    queryFn: () => client.studio.listMine(),
  })
  const stories = query.data ?? []

  const getStudioStory = useCallback(
    (slug: string) => stories.find((s) => s.slug === slug),
    [stories],
  )

  const applyOptimistic = useCallback(
    (fn: (list: StudioStory[]) => StudioStory[]) => {
      const prev = qc.getQueryData<StudioStory[]>(key) ?? stories
      qc.setQueryData<StudioStory[]>(key, fn(prev))
      return prev
    },
    [qc, key, stories],
  )

  const mutateChapterList = useCallback(
    (list: StudioStory[], slug: string, chapterId: string, fn: (c: StudioChapter) => StudioChapter) =>
      list.map((s) =>
        s.slug === slug ? { ...s, chapters: s.chapters.map((c) => (c.id === chapterId ? fn(c) : c)) } : s,
      ),
    [],
  )

  function useListMutation<TArgs>(
    persist: (args: TArgs) => Promise<void>,
    optimistic: (list: StudioStory[], args: TArgs) => StudioStory[],
    onSuccess?: (args: TArgs) => void,
  ) {
    return useMutation({
      mutationFn: persist,
      onMutate: async (args: TArgs) => {
        await qc.cancelQueries({ queryKey: key })
        const prev = applyOptimistic((list) => optimistic(list, args))
        return { prev }
      },
      onError: (_err, _args, ctx) => {
        if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      },
      onSuccess: onSuccess ? (_data, args) => onSuccess(args) : undefined,
    })
  }

  const updateStoryMutation = useListMutation(
    ({ slug, patch }: { slug: string; patch: Partial<StudioStory> }) => client.studio.updateStory(slug, patch),
    (list, { slug, patch }) => list.map((s) => (s.slug === slug ? { ...s, ...patch } : s)),
  )

  const updateChapterMutation = useListMutation(
    ({ slug, chapterId, patch }: { slug: string; chapterId: string; patch: Partial<StudioChapter> }) =>
      client.studio.updateChapter(slug, chapterId, patch),
    (list, { slug, chapterId, patch }) =>
      mutateChapterList(list, slug, chapterId, (c) => {
        const next = { ...c, ...patch }
        if (patch.body !== undefined) next.wordCount = countWords(patch.body)
        return next
      }),
    ({ chapterId, patch }) => {
      // Throttled to once a minute per chapter — not every autosave tick.
      if (patch.body === undefined) return
      throttled(`draft_saved:${chapterId}`, 60_000, () => {
        analytics.draftSaved(chapterId, countWords(patch.body as string))
      })
    },
  )

  const setChapterStateMutation = useListMutation(
    ({ slug, chapterId, state }: { slug: string; chapterId: string; state: ChapterState }) =>
      client.studio.setChapterState(slug, chapterId, state),
    (list, { slug, chapterId, state }) =>
      mutateChapterList(list, slug, chapterId, (c) => ({
        ...c,
        state,
        scheduledAt: state === 'scheduled' ? c.scheduledAt : undefined,
      })),
    ({ slug, chapterId, state }) => {
      if (state !== 'published') return
      const before = getStudioStory(slug)?.chapters.find((c) => c.id === chapterId)
      if (!before) return
      analytics.chapterPublished({
        storyId: slug,
        chapterId,
        chapterNumber: before.number,
        wordCount: before.wordCount,
        wasScheduled: before.state === 'scheduled',
      })
    },
  )

  const scheduleChapterMutation = useListMutation(
    ({ slug, chapterId, at }: { slug: string; chapterId: string; at: number }) =>
      client.studio.scheduleChapter(slug, chapterId, at),
    (list, { slug, chapterId, at }) =>
      mutateChapterList(list, slug, chapterId, (c) => ({ ...c, state: 'scheduled', scheduledAt: at })),
    ({ chapterId, at }) => {
      const leadTimeHours = Math.max(0, Math.round((at - Date.now()) / 3_600_000))
      analytics.chapterScheduled(chapterId, leadTimeHours)
    },
  )

  const setPaywallMutation = useListMutation(
    ({ slug, chapterId, locked }: { slug: string; chapterId: string; locked: boolean }) =>
      client.studio.setPaywall(slug, chapterId, locked),
    (list, { slug, chapterId, locked }) => mutateChapterList(list, slug, chapterId, (c) => ({ ...c, locked })),
  )

  const deleteChapterMutation = useListMutation(
    ({ slug, chapterId }: { slug: string; chapterId: string }) => client.studio.deleteChapter(slug, chapterId),
    (list, { slug, chapterId }) =>
      list.map((s) =>
        s.slug === slug
          ? {
              ...s,
              chapters: s.chapters.filter((c) => c.id !== chapterId).map((c, i) => ({ ...c, number: i + 1 })),
            }
          : s,
      ),
  )

  // createStory / addChapter need the server-assigned id back synchronously
  // for navigation, so they optimistically insert a locally-generated id and
  // reconcile if the backend ever disagrees (the local adapter never does).
  const createStoryMutation = useMutation({
    mutationFn: () => client.studio.createStory(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key })
      const tempSlug = `draft-${uid().slice(0, 8)}`
      const prev = applyOptimistic((list) => [
        {
          slug: tempSlug,
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
      return { prev, tempSlug }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSuccess: (slug, _vars, ctx) => {
      if (ctx?.tempSlug && ctx.tempSlug !== slug) {
        qc.setQueryData<StudioStory[]>(key, (list) =>
          (list ?? []).map((s) => (s.slug === ctx.tempSlug ? { ...s, slug } : s)),
        )
      }
      analytics.storyCreated()
    },
  })

  const addChapterMutation = useMutation({
    mutationFn: ({ slug }: { slug: string }) => client.studio.addChapter(slug),
    onMutate: async ({ slug }: { slug: string }) => {
      await qc.cancelQueries({ queryKey: key })
      const tempId = uid()
      const prev = applyOptimistic((list) =>
        list.map((s) =>
          s.slug === slug
            ? {
                ...s,
                chapters: [
                  ...s.chapters,
                  {
                    id: tempId,
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
      return { prev, tempId }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSuccess: (id, { slug }, ctx) => {
      if (ctx?.tempId && ctx.tempId !== id) {
        qc.setQueryData<StudioStory[]>(key, (list) =>
          (list ?? []).map((s) =>
            s.slug === slug
              ? { ...s, chapters: s.chapters.map((c) => (c.id === ctx.tempId ? { ...c, id } : c)) }
              : s,
          ),
        )
      }
      analytics.chapterCreated(slug)
    },
  })

  const createStory = useCallback(() => createStoryMutation.mutateAsync(), [createStoryMutation])
  const addChapter = useCallback(
    (slug: string) => addChapterMutation.mutateAsync({ slug }),
    [addChapterMutation],
  )
  const updateStory = useCallback(
    (slug: string, patch: Partial<StudioStory>) => updateStoryMutation.mutate({ slug, patch }),
    [updateStoryMutation],
  )
  const updateChapter = useCallback(
    (slug: string, chapterId: string, patch: Partial<StudioChapter>) =>
      updateChapterMutation.mutate({ slug, chapterId, patch }),
    [updateChapterMutation],
  )
  const setChapterState = useCallback(
    (slug: string, chapterId: string, state: ChapterState) =>
      setChapterStateMutation.mutate({ slug, chapterId, state }),
    [setChapterStateMutation],
  )
  const scheduleChapter = useCallback(
    (slug: string, chapterId: string, at: number) =>
      scheduleChapterMutation.mutate({ slug, chapterId, at }),
    [scheduleChapterMutation],
  )
  const setPaywall = useCallback(
    (slug: string, chapterId: string, locked: boolean) =>
      setPaywallMutation.mutate({ slug, chapterId, locked }),
    [setPaywallMutation],
  )
  const deleteChapter = useCallback(
    (slug: string, chapterId: string) => deleteChapterMutation.mutate({ slug, chapterId }),
    [deleteChapterMutation],
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
