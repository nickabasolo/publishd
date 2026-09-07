import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ReadingView } from '@/components/reading-view'
import { ChapterDrawer } from '@/components/chapter-drawer'
import { getStory } from '@/data'
import { useActiveRead } from '@/hooks/use-active-read'

export function ReadPage() {
  const { slug, chapterNumber } = useParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { startChapter } = useActiveRead()

  const story = getStory(slug)
  const requested = chapterNumber ? Number(chapterNumber) : 1
  const chapter =
    story?.chapters.find((c) => c.number === requested) ?? story?.chapters[0]

  useEffect(() => {
    if (story && chapter && !chapter.locked) {
      startChapter(story.slug, chapter.number)
    }
  }, [story, chapter, startChapter])

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
