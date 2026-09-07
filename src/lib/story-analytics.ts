import { getStory } from '@/data'
import { PARAGRAPH_LIKE_SEED } from '@/data/comments-seed'

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export interface StoryAnalytics {
  totalReads: number
  likes: number
  comments: number
  subscribers: number
  completionRate: number // 0..1
  readsByChapter: { label: string; value: number }[]
  readsLast30: number[]
  topPassages: { chapter: number; paragraph: number; likes: number }[]
}

// Deterministic, illustrative — real analytics are still being designed.
export function getStoryAnalytics(slug: string): StoryAnalytics {
  const story = getStory(slug)
  const h = hash(slug)
  const chapters = story?.chapters.length ?? 3

  const firstChapterReads = 4000 + (h % 38000)
  const readsByChapter = Array.from({ length: chapters }, (_, i) => ({
    label: `${i + 1}`,
    value: Math.round(
      firstChapterReads * Math.pow(0.86, i) * (0.9 + (hash(slug + i) % 20) / 100),
    ),
  }))
  const totalReads =
    readsByChapter.reduce((n, c) => n + c.value, 0) || firstChapterReads

  const readsLast30 = Array.from({ length: 30 }, (_, i) => {
    const base = 120 + (h % 220)
    const wobble = ((hash(slug + 'd' + i) % 100) - 50) / 50
    const trend = 1 + i / 55
    return Math.max(20, Math.round(base * trend * (1 + wobble * 0.4)))
  })

  const seeded = Object.entries(PARAGRAPH_LIKE_SEED)
    .filter(([k]) => k.startsWith(`${slug}/`))
    .map(([k, likes]) => {
      const [, chapter, paragraph] = k.split('/')
      return { chapter: Number(chapter), paragraph: Number(paragraph), likes }
    })

  const topPassages = (
    seeded.length
      ? seeded
      : Array.from({ length: 3 }, (_, i) => ({
          chapter: 1 + (hash(slug + 'p' + i) % Math.max(chapters, 1)),
          paragraph: hash(slug + 'q' + i) % 6,
          likes: 8 + (hash(slug + 'l' + i) % 60),
        }))
  )
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 4)

  return {
    totalReads,
    likes: story?.stats.likes ?? 100 + (h % 900),
    comments: story?.stats.comments ?? 20 + (h % 380),
    subscribers: 40 + (h % 880),
    completionRate: 0.35 + (h % 45) / 100,
    readsByChapter,
    readsLast30,
    topPassages,
  }
}
