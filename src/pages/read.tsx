import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ReadingView } from '@/components/reading-view'
import { ChapterDrawer } from '@/components/chapter-drawer'
import { Loading } from '@/components/ui/loading'
import { useDataClient } from '@/lib/data'
import { toLegacyStory } from '@/lib/data/adapt'
import { useReadingProgress } from '@/hooks/use-reading-progress'

export function ReadPage() {
  const { slug, chapterNumber } = useParams()
  const client = useDataClient()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const storyQuery = useQuery({
    queryKey: ['stories', 'bySlug', slug],
    queryFn: () => client.stories.getBySlug(slug as string),
    enabled: Boolean(slug),
  })
  const story = useMemo(
    () => (storyQuery.data ? toLegacyStory(storyQuery.data) : null),
    [storyQuery.data],
  )

  const requested = chapterNumber ? Number(chapterNumber) : 1
  const chapterQuery = useQuery({
    queryKey: ['chapters', 'get', slug, requested],
    queryFn: () => client.chapters.get(slug as string, requested),
    enabled: Boolean(slug),
  })
  // Mirrors the old `story.chapters.find(...) ?? story.chapters[0]` fallback:
  // if the requested chapter number doesn't exist, fall back to the story's
  // first chapter rather than 404ing.
  const chapter = chapterQuery.data ?? story?.chapters[0] ?? null

  const { startChapter } = useReadingProgress(story?.slug ?? '')

  const isLoading = storyQuery.isLoading || chapterQuery.isLoading

  useEffect(() => {
    if (story && chapter && !chapter.locked) {
      // `source` defaults to 'direct' here; reading_resumed (fired from the
      // library and the now-reading bar) covers the two other real sources
      // — see the plan's discovery taxonomy for the full source enum.
      startChapter(chapter.number)
    }
  }, [story, chapter, startChapter])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-paper dark:bg-night">
        <Loading />
      </div>
    )
  }

  if (!story || !chapter) return <Navigate to="/" replace />

  // Locked chapters aren't readable in this prototype — bounce to chapter 1.
  if (chapter.locked) return <Navigate to={`/read/${story.slug}/1`} replace />

  return (
    <>
      <ReadingView
        story={story}
        chapter={chapter}
        onOpenChapters={() => setDrawerOpen(true)}
      />
      <ChapterDrawer
        story={story}
        currentChapterNumber={chapter.number}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
}
