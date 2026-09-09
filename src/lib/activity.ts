import { parseAnchor, type AuthoredComment } from '@/hooks/use-comments'
import type { Story } from '@/lib/data'

// Pinned "now" — matches lib/format.ts so relative times stay stable.
const NOW = new Date('2026-09-06T09:00:00Z').getTime()
const H = 3600 * 1000

export type ActivityKind = 'comment' | 'like-story' | 'like-passage' | 'publish'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  at: number
  storySlug: string
  storyPublicId: string
  storyTitle: string
  chapter?: number
  paragraph?: number
  excerpt?: string
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Minimal story info activity items need, keyed by slug — fetched through the data contract. */
export type StoryLookup = Map<string, Pick<Story, 'slug' | 'publicId' | 'title' | 'updatedAt'>>

interface BuildArgs {
  handle: string
  isSelf: boolean
  comments: AuthoredComment[]
  publishedSlugs: string[]
  likedStorySlugs?: string[]
  likedParagraphAnchors?: string[]
  /** Story data (title/publicId/updatedAt) for every slug referenced above, keyed by slug. */
  stories: StoryLookup
  /** A small pool of real stories to draw from when another person's feed would otherwise be empty. */
  fallbackPool?: Story[]
}

export function buildActivity(a: BuildArgs): ActivityItem[] {
  const items: ActivityItem[] = []
  const title = (slug: string) => a.stories.get(slug)?.title ?? slug
  const publicId = (slug: string) => a.stories.get(slug)?.publicId ?? slug

  for (const c of a.comments) {
    const { slug, chapter, paragraph } = parseAnchor(c.anchor)
    items.push({
      id: `c-${c.anchor}-${c.at}`,
      kind: 'comment',
      at: c.at,
      storySlug: slug,
      storyPublicId: publicId(slug),
      storyTitle: title(slug),
      chapter,
      paragraph,
      excerpt: c.body,
    })
  }

  for (const slug of a.likedStorySlugs ?? []) {
    items.push({
      id: `ls-${slug}`,
      kind: 'like-story',
      at: NOW - ((hash(a.handle + slug) % 240) + 1) * H,
      storySlug: slug,
      storyPublicId: publicId(slug),
      storyTitle: title(slug),
    })
  }

  for (const anchor of a.likedParagraphAnchors ?? []) {
    const { slug, chapter, paragraph } = parseAnchor(anchor)
    items.push({
      id: `lp-${anchor}`,
      kind: 'like-passage',
      at: NOW - ((hash(a.handle + anchor) % 300) + 1) * H,
      storySlug: slug,
      storyPublicId: publicId(slug),
      storyTitle: title(slug),
      chapter,
      paragraph,
    })
  }

  for (const slug of a.publishedSlugs) {
    const s = a.stories.get(slug)
    items.push({
      id: `pub-${slug}`,
      kind: 'publish',
      at: s ? new Date(s.updatedAt).getTime() : NOW,
      storySlug: slug,
      storyPublicId: publicId(slug),
      storyTitle: title(slug),
    })
  }

  // Keep other people's feeds from being empty.
  const pool = a.fallbackPool ?? []
  if (!a.isSelf && a.comments.length === 0 && a.publishedSlugs.length === 0 && pool.length > 0) {
    const n = 1 + (hash(a.handle) % 2)
    for (let i = 0; i < n; i++) {
      const s = pool[hash(a.handle + i) % pool.length]
      items.push({
        id: `fl-${a.handle}-${i}`,
        kind: 'like-story',
        at: NOW - ((hash(a.handle + s.slug) % 500) + 5) * H,
        storySlug: s.slug,
        storyPublicId: s.publicId,
        storyTitle: s.title,
      })
    }
  }

  return items.sort((x, y) => y.at - x.at)
}
