import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Settings } from 'lucide-react'
import { StateBadge } from '@/components/studio/state-badge'
import { ScheduleSheet } from '@/components/studio/schedule-sheet'
import { ChatComposer } from '@/components/studio/chat-composer'
import { useStudio } from '@/hooks/use-studio'
import { formatRelativeFuture } from '@/lib/format'
import type { ChatParticipants } from '@/lib/types'

const DEFAULT_PARTICIPANTS: ChatParticipants = {
  a: { name: 'Them', color: '#94a3b8' },
  b: { name: 'You', color: '#6366f1' },
}

export function ChapterEditorPage() {
  const { slug = '', chapterId = '' } = useParams()
  const studio = useStudio()
  const [scheduling, setScheduling] = useState(false)

  const story = studio.getStudioStory(slug)
  const chapter = story?.chapters.find((c) => c.id === chapterId)
  if (!story || !chapter) return <Navigate to={`/studio/${slug}`} replace />

  return (
    <div className="flex h-full flex-col bg-paper dark:bg-night">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3 dark:border-white/10">
        <Link
          to={`/studio/${slug}`}
          className="inline-flex items-center gap-1.5 font-sans text-sm text-ink-soft hover:text-ink dark:text-stone-400"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{story.title}</span>
        </Link>
        <div className="flex items-center gap-3 font-sans text-xs text-ink-soft dark:text-stone-500">
          <span className="hidden sm:inline">{chapter.wordCount.toLocaleString()} words · saved</span>
          <StateBadge state={chapter.state} />
          <Link
            to={`/studio/${slug}`}
            title="Story settings"
            className="inline-flex items-center gap-1.5 border border-ink/25 px-2 py-1 hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/5"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[800px] px-5 py-8">
          <input
            value={chapter.title}
            onChange={(e) => studio.updateChapter(slug, chapterId, { title: e.target.value })}
            placeholder="Chapter title"
            className="w-full bg-transparent font-serif text-2xl leading-tight text-ink outline-none placeholder:text-ink-soft/50 dark:text-stone-100"
          />
          {story.format === 'chat' ? (
            <ChatComposer
              messages={chapter.messages ?? []}
              participants={story.chatParticipants ?? DEFAULT_PARTICIPANTS}
              onChange={(messages) => studio.updateChapter(slug, chapterId, { messages, title: chapter.title })}
            />
          ) : (
            <textarea
              value={chapter.body}
              onChange={(e) => studio.updateChapter(slug, chapterId, { body: e.target.value })}
              placeholder="Start writing. Leave a blank line between paragraphs."
              className="mt-6 min-h-[50vh] w-full resize-none bg-transparent font-serif text-[15px] leading-[1.75] text-ink outline-none placeholder:text-ink-soft/50 dark:text-stone-200"
            />
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 px-4 py-3 dark:border-white/10">
        {chapter.state === 'published' ? (
          <button
            type="button"
            onClick={() => studio.setChapterState(slug, chapterId, 'draft')}
            className="border border-ink/25 px-4 py-2 font-sans text-sm font-medium hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/5"
          >
            Unpublish
          </button>
        ) : chapter.number === 1 ? (
          <>
            <button
              type="button"
              onClick={() => {
                studio.setChapterState(slug, chapterId, 'published')
                studio.updateStory(slug, { status: 'complete' })
              }}
              className="border border-ink/25 px-4 py-2 font-sans text-sm font-medium hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/5"
            >
              Publish as complete
            </button>
            <button
              type="button"
              onClick={() => studio.setChapterState(slug, chapterId, 'published')}
              className="bg-ink px-4 py-2 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900"
            >
              Publish & keep going
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => studio.setChapterState(slug, chapterId, 'published')}
            className="bg-ink px-4 py-2 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900"
          >
            Publish
          </button>
        )}
        <button
          type="button"
          onClick={() => setScheduling(true)}
          className="border border-ink/25 px-4 py-2 font-sans text-sm font-medium hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/5"
        >
          {chapter.state === 'scheduled' && chapter.scheduledAt
            ? `Scheduled ${formatRelativeFuture(chapter.scheduledAt)}`
            : 'Schedule…'}
        </button>
        <button
          type="button"
          onClick={() =>
            studio.setPaywall(slug, chapterId, !chapter.locked)
          }
          className="ml-auto font-sans text-sm font-medium text-ink-soft hover:text-ink dark:text-stone-400"
        >
          {chapter.locked ? 'Remove paywall' : 'Add paywall'}
        </button>
      </div>

      <ScheduleSheet
        open={scheduling}
        chapterTitle={chapter.title || 'This chapter'}
        initial={chapter.scheduledAt}
        onClose={() => setScheduling(false)}
        onConfirm={(at) => {
          studio.scheduleChapter(slug, chapterId, at)
          setScheduling(false)
        }}
      />
    </div>
  )
}
