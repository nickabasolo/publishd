// Dev-only UI/UX sandbox. Feeds real presentational design-system components
// with loose hand-written fixtures — zero DataClient/hook/network coupling.
// See src/playground/fixtures.ts and the report handed back for how each
// sandbox was chosen.
import { useMemo, useState } from 'react'
import { StoryPreviewCard } from '@/components/story-preview-card'
import { StateBadge } from '@/components/studio/state-badge'
import { ChatComposer, type ChatMessage } from '@/components/studio/chat-composer'
import { ProseChapterBody } from '@/components/reading/prose-chapter-body'
import { ChatChapterBody } from '@/components/reading/chat-chapter-body'
import type { Story } from '@/lib/types'
import {
  proseStory,
  chatStory,
  feedShort,
  feedLong,
  feedEmpty,
  type PgStory,
} from '@/playground/fixtures'

// Harmless static stand-ins for the like/comment-count hook shapes that
// ProseChapterBody / ChatChapterBody expect, so we can render them without
// wiring up useParagraphLikes / useChapterCommentCounts against a backend.
function fakeParaLikes() {
  return {
    has: (_i: number) => false,
    totalLikes: (_i: number) => 0,
    toggle: (_i: number) => {},
  }
}
function fakeCommentCounts(paragraphCount: number) {
  return { paragraphs: Array.from({ length: paragraphCount }, () => 0), total: 0 }
}

function JsonEditor({
  value,
  onChange,
}: {
  value: unknown
  onChange: (next: unknown) => void
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2))
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          try {
            onChange(JSON.parse(e.target.value))
            setError(null)
          } catch {
            setError('Invalid JSON — showing last valid render.')
          }
        }}
        rows={14}
        className="w-full rounded-lg border border-ink/10 bg-ink/[0.02] p-3 font-mono text-xs text-ink dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-200"
        spellCheck={false}
      />
      {error && <p className="font-sans text-xs text-rose-500">{error}</p>}
    </div>
  )
}

function Sandbox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-ink/10 p-5 dark:border-white/10">
      <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft dark:text-stone-400">
        {title}
      </h2>
      {children}
    </section>
  )
}

function StoryPreviewSandbox({ initial, label }: { initial: PgStory; label: string }) {
  const [story, setStory] = useState<PgStory>(initial)
  return (
    <Sandbox title={label}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="max-w-md">
          {/* PgStory is structurally compatible with the fields StoryPreviewCard
              reads; cast at the boundary rather than importing the strict type. */}
          <StoryPreviewCard story={story as unknown as Story} />
        </div>
        <JsonEditor value={story} onChange={(v) => setStory(v as PgStory)} />
      </div>
    </Sandbox>
  )
}

function HomeFeedSandbox({ initial, label }: { initial: PgStory[]; label: string }) {
  const [stories, setStories] = useState<PgStory[]>(initial)
  return (
    <Sandbox title={label}>
      <div className="flex flex-col gap-4">
        {stories.length === 0 ? (
          <p className="font-sans text-sm text-ink-soft dark:text-stone-400">
            (empty feed — nothing to render)
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((s) => (
              <StoryPreviewCard key={s.id} story={s as unknown as Story} />
            ))}
          </div>
        )}
        <JsonEditor value={stories} onChange={(v) => setStories(v as PgStory[])} />
      </div>
    </Sandbox>
  )
}

function ChapterBodySandbox() {
  const paraLikes = useMemo(fakeParaLikes, [])
  const proseCommentCounts = useMemo(
    () => fakeCommentCounts(proseStory.chapters[0].paragraphs.length),
    [],
  )
  const chatCommentCounts = useMemo(
    () => fakeCommentCounts(chatStory.chapters[0].paragraphs.length),
    [],
  )
  return (
    <Sandbox title="Chapter body — prose vs chat (presentational renderers)">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 font-sans text-xs text-ink-soft dark:text-stone-400">Prose</p>
          <div className="prose max-w-none space-y-4">
            <ProseChapterBody
              chapter={proseStory.chapters[0] as never}
              commentCounts={proseCommentCounts as never}
              paraLikes={paraLikes as never}
              setActivePara={() => {}}
            />
          </div>
        </div>
        <div>
          <p className="mb-2 font-sans text-xs text-ink-soft dark:text-stone-400">Chat</p>
          <div className="space-y-4">
            <ChatChapterBody
              chapter={chatStory.chapters[0] as never}
              story={chatStory as unknown as Story}
              commentCounts={chatCommentCounts as never}
              paraLikes={paraLikes as never}
              setActivePara={() => {}}
            />
          </div>
        </div>
      </div>
      <p className="font-sans text-xs text-ink-soft dark:text-stone-400">
        Note: ReadingView itself is NOT reused here — it internally calls useLikes /
        useComments / useReadingProgress / useParagraphLikes (real DataClient hooks).
        Instead this renders its two presentational body pieces directly against
        fixture paragraphs, passing static stand-ins for the like/comment-count props.
      </p>
    </Sandbox>
  )
}

function ChatComposerSandbox() {
  const [messages, setMessages] = useState<ChatMessage[]>(
    chatStory.chapters[0].paragraphs.map((text, i) => ({
      speaker: chatStory.chapters[0].speakers?.[i] ?? 'a',
      text,
    })),
  )
  return (
    <Sandbox title="Chat composer (fully presentational, works standalone)">
      <div className="max-w-lg">
        <ChatComposer
          messages={messages}
          participants={chatStory.chatParticipants!}
          onChange={setMessages}
        />
      </div>
    </Sandbox>
  )
}

function StateBadgeSandbox() {
  return (
    <Sandbox title="State badge">
      <div className="flex gap-2">
        <StateBadge state="draft" />
        <StateBadge state="scheduled" />
        <StateBadge state="published" />
      </div>
    </Sandbox>
  )
}

export function PlaygroundIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-2xl text-ink dark:text-stone-100">UI Playground</h1>
        <p className="mt-1 font-sans text-sm text-ink-soft dark:text-stone-400">
          Dev-only. Renders real presentational design-system components against loose,
          hand-written fixtures — no DataClient, no TanStack Query, no auth. Not included
          in production builds. Edit the JSON under each sandbox to see it re-render live.
        </p>
      </header>
      <div className="flex flex-col gap-8">
        <StoryPreviewSandbox initial={proseStory} label="Story preview card — prose" />
        <StoryPreviewSandbox initial={chatStory} label="Story preview card — chat AU" />
        <HomeFeedSandbox initial={feedShort} label="Home feed layout — short feed" />
        <HomeFeedSandbox initial={feedLong} label="Home feed layout — long/mixed feed" />
        <HomeFeedSandbox initial={feedEmpty} label="Home feed layout — empty state" />
        <ChapterBodySandbox />
        <ChatComposerSandbox />
        <StateBadgeSandbox />
      </div>
    </div>
  )
}
