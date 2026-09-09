// THROWAWAY EXAMPLE — demonstrates the playground pattern only, not a real
// proposal. Delete or ignore once you've seen how it works.
//
// Each file in src/playground/pages/ is a fully standalone page: hardcode
// whatever markup/data you want, inline, right here. No shared shape, no
// props, no fixtures file. Feel free to import real presentational
// components (Avatar, TagLink, StateBadge, ...) and feed them fake inline
// data — just avoid components that call live data hooks internally
// (ReadingView, CommentThread, NowReadingBar, StoryPreviewCard, etc).
import { Avatar } from '@/components/avatar'
import { TagLink } from '@/components/tag-link'
import { StateBadge } from '@/components/studio/state-badge'

const FAKE_STORIES = [
  {
    title: 'The Glass Orchard',
    author: 'R. Okafor',
    color: '#7c5cff',
    tags: ['fantasy', 'slow-burn'],
    blurb: 'A gardener discovers the orchard grows memories instead of fruit.',
  },
  {
    title: 'Static on the Line',
    author: 'M. Delacroix',
    color: '#e0623a',
    tags: ['scifi', 'mystery'],
    blurb: 'The last operator of a dying satellite network hears a voice she recognizes.',
  },
]

export default function ExampleHomeRemix() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 font-serif text-3xl text-ink dark:text-stone-100">
        Home remix — big-cover feed
      </h1>
      <p className="mb-8 text-sm text-ink-soft dark:text-stone-400">
        Rough idea: swap the current text-forward feed rows for large color-block
        "covers" with the byline overlaid, tags below. Hand-rolled markup, not a
        real component — just enough to look at layout weight.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {FAKE_STORIES.map((s) => (
          <div
            key={s.title}
            className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-sm dark:border-white/10 dark:bg-night"
          >
            <div
              className="flex h-32 items-end p-4"
              style={{ background: `linear-gradient(135deg, ${s.color}, #1118)` }}
            >
              <div className="flex items-center gap-2">
                <Avatar name={s.author} color={s.color} size={28} />
                <span className="font-sans text-sm font-medium text-white drop-shadow">
                  {s.author}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h2 className="mb-1 font-serif text-lg text-ink dark:text-stone-100">
                {s.title}
              </h2>
              <p className="mb-3 text-sm text-ink-soft dark:text-stone-400">{s.blurb}</p>
              <div className="flex flex-wrap items-center gap-2">
                {s.tags.map((t) => (
                  <TagLink key={t} tag={t} />
                ))}
                <StateBadge state="draft" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
