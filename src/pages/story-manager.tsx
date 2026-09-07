import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, Plus, X } from 'lucide-react'
import { Segmented } from '@/components/ui/segmented'
import { ChapterRow } from '@/components/studio/chapter-row'
import { ScheduleSheet } from '@/components/studio/schedule-sheet'
import { useStudio } from '@/hooks/use-studio'
import { AVATAR_COLORS } from '@/data/default-user'
import { cn } from '@/lib/utils'
import type { StoryStatus } from '@/lib/types'

const inputCls =
  'w-full rounded-md border border-ink/15 bg-paper px-3 py-2 font-sans text-sm outline-none focus:border-ink/40 dark:border-white/15 dark:bg-surface-night'

export function StoryManagerPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const studio = useStudio()
  const [tagDraft, setTagDraft] = useState('')
  const [scheduleFor, setScheduleFor] = useState<string | null>(null)

  const story = studio.getStudioStory(slug)
  if (!story) return <Navigate to="/studio" replace />

  const scheduleChapter = story.chapters.find((c) => c.id === scheduleFor)

  const addTag = () => {
    const t = tagDraft.trim()
    if (t && !story.tags.includes(t)) studio.updateStory(slug, { tags: [...story.tags, t] })
    setTagDraft('')
  }

  return (
    <div className="min-h-full bg-surface px-4 py-6 pb-32 dark:bg-surface-night md:py-10 md:pb-24">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <Link
            to="/studio"
            className="inline-flex items-center gap-1.5 font-sans text-sm text-ink-soft hover:text-ink dark:text-stone-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Your stories
          </Link>
          <Link
            to={`/studio/${slug}/analytics`}
            className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-ink-soft hover:text-ink dark:text-stone-400"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Link>
        </div>

        {/* Details */}
        <section className="space-y-4 rounded-xl bg-paper p-5 shadow-sm dark:bg-night sm:p-6">
          <div className="flex items-center justify-between">
            <h1 className="font-sans text-lg font-semibold">Story details</h1>
            <span className="font-sans text-xs text-ink-soft dark:text-stone-500">
              All changes saved
            </span>
          </div>

          <label className="block space-y-1.5 font-sans text-sm font-medium">
            <span>Title</span>
            <input
              className={inputCls}
              value={story.title}
              onChange={(e) => studio.updateStory(slug, { title: e.target.value })}
            />
          </label>

          <label className="block space-y-1.5 font-sans text-sm font-medium">
            <span>Blurb</span>
            <textarea
              className={cn(inputCls, 'min-h-16 resize-y')}
              value={story.blurb}
              onChange={(e) => studio.updateStory(slug, { blurb: e.target.value })}
            />
          </label>

          <label className="block space-y-1.5 font-sans text-sm font-medium">
            <span>Synopsis</span>
            <textarea
              className={cn(inputCls, 'min-h-20 resize-y')}
              value={story.synopsis}
              onChange={(e) => studio.updateStory(slug, { synopsis: e.target.value })}
            />
          </label>

          <div className="space-y-1.5">
            <p className="font-sans text-sm font-medium">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {story.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 py-0.5 font-sans text-xs text-ink-soft dark:bg-white/10 dark:text-stone-300"
                >
                  {t}
                  <button
                    type="button"
                    aria-label={`Remove ${t}`}
                    onClick={() =>
                      studio.updateStory(slug, { tags: story.tags.filter((x) => x !== t) })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              className={inputCls}
              placeholder="Add a tag, press Enter"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-sans text-sm font-medium">Cover</p>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cover colour ${c}`}
                  onClick={() => studio.updateStory(slug, { coverColor: c })}
                  className={cn(
                    'h-6 w-6 rounded ring-offset-2 ring-offset-paper transition dark:ring-offset-night',
                    story.coverColor === c && 'ring-2 ring-ink dark:ring-stone-100',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-sans text-sm font-medium">Status</p>
            <Segmented<StoryStatus>
              aria-label="Status"
              size="sm"
              options={[
                { value: 'ongoing', label: 'Ongoing' },
                { value: 'complete', label: 'Complete' },
              ]}
              value={story.status}
              onChange={(v) => studio.updateStory(slug, { status: v })}
            />
          </div>
        </section>

        {/* Chapters */}
        <section className="rounded-xl bg-paper p-5 shadow-sm dark:bg-night sm:p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-sans text-lg font-semibold">
              Chapters
              <span className="ml-1.5 font-normal text-ink-soft dark:text-stone-500">
                {story.chapters.length}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => navigate(`/studio/${slug}/${studio.addChapter(slug)}`)}
              className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-ink-soft hover:text-ink dark:text-stone-400"
            >
              <Plus className="h-4 w-4" />
              Add chapter
            </button>
          </div>

          {story.chapters.length === 0 ? (
            <p className="py-4 font-sans text-sm text-ink-soft dark:text-stone-400">
              No chapters yet.
            </p>
          ) : (
            <div>
              {story.chapters.map((c) => (
                <ChapterRow
                  key={c.id}
                  slug={slug}
                  chapter={c}
                  onSetState={(state) => studio.setChapterState(slug, c.id, state)}
                  onSetPaywall={(locked) => studio.setPaywall(slug, c.id, locked)}
                  onSchedule={() => setScheduleFor(c.id)}
                  onDelete={() => studio.deleteChapter(slug, c.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <ScheduleSheet
        open={scheduleChapter != null}
        chapterTitle={scheduleChapter?.title || 'This chapter'}
        initial={scheduleChapter?.scheduledAt}
        onClose={() => setScheduleFor(null)}
        onConfirm={(at) => {
          if (scheduleFor) studio.scheduleChapter(slug, scheduleFor, at)
          setScheduleFor(null)
        }}
      />
    </div>
  )
}
