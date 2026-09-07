import { stories } from '@/data'

export type ChapterState = 'draft' | 'scheduled' | 'published'

export interface StudioChapter {
  id: string
  number: number
  title: string
  body: string // paragraphs = body.split(/\n\s*\n/)
  state: ChapterState
  scheduledAt?: number
  locked: boolean // paywall
  wordCount: number
}

export interface StudioStory {
  slug: string
  title: string
  blurb: string
  synopsis: string
  tags: string[]
  coverColor: string
  status: 'ongoing' | 'complete'
  chapters: StudioChapter[]
  isNew?: boolean
}

// Bump when the baseline shape/content below changes — forces a re-seed.
export const STUDIO_VERSION = 1

// A pinned future date, a few days past the prototype's pinned "now".
const SCHEDULED_AT = new Date('2026-09-12T18:00:00Z').getTime()

export function countWords(body: string): number {
  const t = body.trim()
  return t ? t.split(/\s+/).length : 0
}

export function bodyToParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** Read-only baseline derived from the seed stories authored by `handle`. */
export function studioBaseline(handle: string): StudioStory[] {
  return stories
    .filter((s) => s.author.handle === handle)
    .map((s, si) => {
      const chapters: StudioChapter[] = s.chapters.map((c, ci) => {
        const body = c.paragraphs.join('\n\n')
        // Demo spread: leave the last chapter of the first story as a draft.
        const state: ChapterState =
          si === 0 && ci === s.chapters.length - 1 ? 'draft' : 'published'
        return {
          id: c.id,
          number: c.number,
          title: c.title,
          body,
          state,
          locked: c.locked ?? false,
          wordCount: countWords(body),
        }
      })

      // Give the first story one scheduled release too.
      if (si === 0) {
        chapters.push({
          id: `${s.slug}-scheduled`,
          number: chapters.length + 1,
          title: 'The Reckoning',
          body: '',
          state: 'scheduled',
          scheduledAt: SCHEDULED_AT,
          locked: true,
          wordCount: 0,
        })
      }

      return {
        slug: s.slug,
        title: s.title,
        blurb: s.blurb,
        synopsis: s.synopsis,
        tags: [...s.tags],
        coverColor: s.coverColor,
        status: s.status,
        chapters,
      }
    })
}

export function chapterCounts(story: StudioStory): Record<ChapterState, number> {
  return story.chapters.reduce(
    (acc, c) => {
      acc[c.state] += 1
      return acc
    },
    { draft: 0, scheduled: 0, published: 0 } as Record<ChapterState, number>,
  )
}
