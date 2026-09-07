import { COMMENT_SEED } from '@/data/comments-seed'
import { stories, getStory } from '@/data'
import { parseAnchor, type AuthoredComment } from '@/hooks/use-comments'

// Pinned "now" — matches lib/format.ts so relative times stay stable.
const NOW = new Date('2026-09-06T09:00:00Z').getTime()
const H = 3600 * 1000

export type ActivityKind = 'comment' | 'like-story' | 'like-passage' | 'publish'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  at: number
  storySlug: string
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

/** Seeded comments/replies authored by `handle` (used for other people's feeds). */
export function seededCommentsBy(handle: string): AuthoredComment[] {
  const out: AuthoredComment[] = []
  for (const [anchor, list] of Object.entries(COMMENT_SEED)) {
    for (const c of list) {
      if (c.author.handle === handle) {
        out.push({ body: c.body, at: c.createdAt, anchor, isReply: false })
      }
      for (const r of c.replies) {
        if (r.author.handle === handle) {
          out.push({ body: r.body, at: r.createdAt, anchor, isReply: true })
        }
      }
    }
  }
  return out
}

interface BuildArgs {
  handle: string
  isSelf: boolean
  comments: AuthoredComment[]
  publishedSlugs: string[]
  likedStorySlugs?: string[]
  likedParagraphAnchors?: string[]
}

export function buildActivity(a: BuildArgs): ActivityItem[] {
  const items: ActivityItem[] = []
  const title = (slug: string) => getStory(slug)?.title ?? slug

  for (const c of a.comments) {
    const { slug, chapter, paragraph } = parseAnchor(c.anchor)
    items.push({
      id: `c-${c.anchor}-${c.at}`,
      kind: 'comment',
      at: c.at,
      storySlug: slug,
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
      storyTitle: title(slug),
      chapter,
      paragraph,
    })
  }

  for (const slug of a.publishedSlugs) {
    const s = getStory(slug)
    items.push({
      id: `pub-${slug}`,
      kind: 'publish',
      at: s ? new Date(s.updatedAt).getTime() : NOW,
      storySlug: slug,
      storyTitle: title(slug),
    })
  }

  // Keep other people's feeds from being empty.
  if (!a.isSelf && a.comments.length === 0 && a.publishedSlugs.length === 0) {
    const n = 1 + (hash(a.handle) % 2)
    for (let i = 0; i < n; i++) {
      const s = stories[hash(a.handle + i) % stories.length]
      items.push({
        id: `fl-${a.handle}-${i}`,
        kind: 'like-story',
        at: NOW - ((hash(a.handle + s.slug) % 500) + 5) * H,
        storySlug: s.slug,
        storyTitle: s.title,
      })
    }
  }

  return items.sort((x, y) => y.at - x.at)
}
