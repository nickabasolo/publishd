import rawStories from './stories.json'
import type { Story } from '@/lib/types'
import { publicIdForSlug } from '@/lib/public-id'

export const stories = (rawStories as Story[]).map((s) => ({
  ...s,
  publicId: publicIdForSlug(s.slug),
}))

export function getStory(slug: string | undefined): Story | undefined {
  if (!slug) return undefined
  return stories.find((s) => s.slug === slug)
}

export function getStoriesByTag(tag: string): Story[] {
  const t = tag.toLowerCase()
  return stories.filter((s) => s.tags.some((x) => x.toLowerCase() === t))
}

export function allTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of stories) {
    for (const tag of s.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
