import { stories } from '@/data'
import { COMMENT_PERSONAS } from '@/data/comments-seed'
import type { FakeStats } from '@/lib/types'

export interface Person {
  handle: string
  name: string
  avatarColor: string
  bio: string
  isAuthor: boolean
  storySlugs: string[]
}

// Stable small hash of a handle → used to pick fake bios / stats deterministically.
function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

const PERSON_BIOS = [
  'Reads more than is strictly reasonable. Will argue about endings.',
  'Here for the slow burns and the worldbuilding.',
  'Comment-section lurker turned regular. Sorry in advance.',
  'Chasing the feeling of finishing a really good chapter at 2am.',
  'Serialised fiction is the only format that gets me.',
  'Tags are a love language.',
  'Mostly here to yell about my favourite side characters.',
  'Between books. Always between books.',
]

function bioFor(handle: string): string {
  return PERSON_BIOS[hash(handle) % PERSON_BIOS.length]
}

const PEOPLE: Record<string, Person> = {}

// Story authors.
for (const s of stories) {
  const a = s.author
  const existing = PEOPLE[a.handle]
  if (existing) {
    existing.storySlugs.push(s.slug)
  } else {
    PEOPLE[a.handle] = {
      handle: a.handle,
      name: a.name,
      avatarColor: a.avatarColor,
      bio: bioFor(a.handle),
      isAuthor: true,
      storySlugs: [s.slug],
    }
  }
}

// Recurring commenters (only add if not already an author).
for (const p of Object.values(COMMENT_PERSONAS)) {
  if (PEOPLE[p.handle]) continue
  PEOPLE[p.handle] = {
    handle: p.handle,
    name: p.name,
    avatarColor: p.avatarColor,
    bio: bioFor(p.handle),
    isAuthor: false,
    storySlugs: [],
  }
}

const FALLBACK_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#f43f5e', '#a855f7']

export function getPerson(handle: string): Person {
  return (
    PEOPLE[handle] ?? {
      handle,
      name: `@${handle}`,
      avatarColor: FALLBACK_COLORS[hash(handle) % FALLBACK_COLORS.length],
      bio: bioFor(handle),
      isAuthor: false,
      storySlugs: [],
    }
  )
}

export function allPeople(): Person[] {
  return Object.values(PEOPLE)
}

// Deterministic faked stats for anyone who isn't the local user.
export function fakeStatsFor(handle: string): FakeStats {
  const h = hash(handle)
  return {
    booksRead: 6 + (h % 90),
    chaptersRead: 40 + ((h >> 2) % 600),
    minutesRead: 800 + ((h >> 3) % 12000),
    dayStreak: 1 + (h % 40),
  }
}
