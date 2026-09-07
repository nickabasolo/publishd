import rawStories from './stories.json'
import type { Story } from '@/lib/types'

export const stories = rawStories as Story[]

export function getStory(slug: string | undefined): Story | undefined {
  if (!slug) return undefined
  return stories.find((s) => s.slug === slug)
}
