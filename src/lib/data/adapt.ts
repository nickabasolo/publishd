// Bridges the data-contract DTOs (`./types`) to the legacy page-component
// shapes (`@/lib/types`) that most rendering components were written
// against (`StoryPreviewCard`, `ChapterList`, `ReadingView`, …).
//
// The contract's `Story` intentionally has no denormalized author blob
// (`authorId` + optional joined `author?: ProfileSummary`), but the
// components still expect the old inline `{ name, handle, avatarColor }`
// byline. Rather than touch every component mid-cutover (Phase 8 is a pure
// plumbing change with a zero-visible-difference bar), pages convert at the
// call site with this helper. `Chapter` needs no conversion — its shape is
// identical in both type modules.
import type { Story as ContractStory } from './types'
import type { Author, Story as LegacyStory } from '@/lib/types'

export function toLegacyStory(s: ContractStory): LegacyStory {
  const author: Author = s.author
    ? { name: s.author.displayName, handle: s.author.handle, avatarColor: s.author.avatarColor }
    : { name: s.authorId, handle: s.authorId, avatarColor: '#94a3b8' }
  return {
    id: s.id,
    slug: s.slug,
    publicId: s.publicId,
    title: s.title,
    author,
    tags: s.tags,
    status: s.status,
    blurb: s.blurb,
    synopsis: s.synopsis,
    coverColor: s.coverColor,
    updatedAt: s.updatedAt,
    newChapters: s.newChapters,
    stats: s.stats,
    chapters: s.chapters,
  }
}
