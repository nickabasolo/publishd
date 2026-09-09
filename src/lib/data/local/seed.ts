// Seed/lookup data for the local adapter. This is a faithful port of
// src/data/people.ts + src/data/accounts.ts, adjusted to satisfy the
// contract's rule 2 (`T | null`, no fabricate-a-profile-for-any-handle
// fallback): `resolveProfile` only resolves *known* seed identities (story
// authors, recurring commenters, and the fake local accounts) — a genuinely
// unknown handle resolves to `undefined` rather than a synthesized one.
import rawStories from '@/data/stories.json'
import { COMMENT_PERSONAS } from '@/data/comments-seed'
import { ACCOUNTS, type AccountId as LegacyAccountId } from '@/data/accounts'
import { defaultUser, defaultFakeStats } from '@/data/default-user'
import type { Story as LegacyStory } from '@/lib/types'
import { publicIdForSlug } from '@/lib/public-id'
import type { Profile, ProfileSummary, ReadingStats, Story } from '../types'

const legacyStories = rawStories as LegacyStory[]

// Stable small hash of a handle — used to pick deterministic fake bios/stats.
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

interface SeedPerson {
  handle: string
  displayName: string
  avatarColor: string
  bio: string
  isAuthor: boolean
  storySlugs: string[]
}

const PEOPLE = new Map<string, SeedPerson>()

for (const s of legacyStories) {
  const a = s.author
  const existing = PEOPLE.get(a.handle)
  if (existing) {
    existing.storySlugs.push(s.slug)
  } else {
    PEOPLE.set(a.handle, {
      handle: a.handle,
      displayName: a.name,
      avatarColor: a.avatarColor,
      bio: bioFor(a.handle),
      isAuthor: true,
      storySlugs: [s.slug],
    })
  }
}

for (const p of Object.values(COMMENT_PERSONAS)) {
  if (PEOPLE.has(p.handle)) continue
  PEOPLE.set(p.handle, {
    handle: p.handle,
    displayName: p.name,
    avatarColor: p.avatarColor,
    bio: bioFor(p.handle),
    isAuthor: false,
    storySlugs: [],
  })
}

/** Story author/blurb data, converted to the contract shape (authorId + joined author). */
export const stories: Story[] = legacyStories.map((s) => ({
  id: s.id,
  slug: s.slug,
  publicId: publicIdForSlug(s.slug),
  title: s.title,
  authorId: s.author.handle,
  author: {
    id: s.author.handle,
    handle: s.author.handle,
    displayName: s.author.name,
    avatarColor: s.author.avatarColor,
  },
  tags: s.tags,
  status: s.status,
  blurb: s.blurb,
  synopsis: s.synopsis,
  coverColor: s.coverColor,
  updatedAt: s.updatedAt,
  newChapters: s.newChapters,
  stats: s.stats,
  chapters: s.chapters,
}))

export function getStory(slug: string): Story | undefined {
  return stories.find((s) => s.slug === slug)
}

export function getStoryByPublicId(publicId: string): Story | undefined {
  return stories.find((s) => s.publicId === publicId)
}

/** Known-identity lookup only — see file header. Returns `undefined` for anyone else. */
function findSeedPerson(handle: string): SeedPerson | undefined {
  return PEOPLE.get(handle)
}

export function summaryForHandle(handle: string | undefined): ProfileSummary | undefined {
  if (!handle) return undefined
  for (const account of Object.values(ACCOUNTS)) {
    if (account.user.username === handle) {
      return {
        id: handle,
        handle,
        displayName: account.user.displayName,
        avatarColor: account.user.avatarColor,
      }
    }
  }
  const person = findSeedPerson(handle)
  if (person) {
    return { id: handle, handle, displayName: person.displayName, avatarColor: person.avatarColor }
  }
  return undefined
}

/**
 * Full profile for a known handle. `localUser` — the caller's own, possibly
 * edited, profile record for `handle` if it happens to be *their* account —
 * takes precedence over the static seed so edits made in Settings show up.
 */
export function resolveProfile(
  handle: string,
  localUser?: { displayName: string; avatarColor: string; bio: string; favoriteGenres: string[] },
): Profile | null {
  if (localUser) {
    const selfStorySlugs = stories.filter((s) => s.authorId === handle).map((s) => s.slug)
    return {
      id: handle,
      handle,
      displayName: localUser.displayName,
      avatarColor: localUser.avatarColor,
      bio: localUser.bio,
      favoriteGenres: localUser.favoriteGenres,
      isAuthor: selfStorySlugs.length > 0,
      author: selfStorySlugs.length > 0 ? { penName: localUser.displayName, publishedStoryIds: selfStorySlugs } : undefined,
    }
  }

  const person = findSeedPerson(handle)
  if (!person) return null

  return {
    id: handle,
    handle,
    displayName: person.displayName,
    avatarColor: person.avatarColor,
    bio: person.bio,
    favoriteGenres: [],
    isAuthor: person.isAuthor,
    author: person.isAuthor
      ? { penName: person.displayName, publishedStoryIds: person.storySlugs }
      : undefined,
  }
}

/** Deterministic faked stats for anyone who isn't the local user. */
export function fakeStatsFor(handle: string): ReadingStats {
  const h = hash(handle)
  return {
    booksRead: 6 + (h % 90),
    chaptersRead: 40 + ((h >> 2) % 600),
    minutesRead: 800 + ((h >> 3) % 12000),
    dayStreak: 1 + (h % 40),
  }
}

export type AccountId = LegacyAccountId
export { ACCOUNTS, defaultUser, defaultFakeStats }
