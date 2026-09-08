// DTOs for the data-access contract (`src/lib/data/client.ts`).
//
// Three rules, enforced here by types rather than convention (see the phase-1 plan):
//  1. `Page<T>` for anything that can grow unboundedly.
//  2. `T | null` for anything that may not exist — no falling back to a demo object.
//  3. No denormalized author blobs — `authorId` + an optional joined `author?`.

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface PageParams {
  limit?: number
  cursor?: string | null
}

// ---- Identity -------------------------------------------------------------

/** The minimal, joinable identity blob. This is the only shape a list method may embed. */
export interface ProfileSummary {
  id: string
  handle: string
  displayName: string
  avatarColor: string
}

export interface AuthorInfo {
  penName: string
  publishedStoryIds: string[]
}

export interface Profile extends ProfileSummary {
  bio: string
  favoriteGenres: string[]
  isAuthor: boolean
  author?: AuthorInfo
}

export interface ReadingStats {
  booksRead: number
  chaptersRead: number
  minutesRead: number
  dayStreak: number
}

// ---- Content ----------------------------------------------------------------

export interface Chapter {
  id: string
  number: number
  title: string
  wordCount: number
  locked?: boolean
  paragraphs: string[]
}

export type StoryStatus = 'ongoing' | 'complete'

export interface StoryStats {
  hits: number
  comments: number
  likes: number
}

export interface Story {
  id: string
  slug: string
  title: string
  authorId: string
  author?: ProfileSummary
  tags: string[]
  status: StoryStatus
  blurb: string
  synopsis: string
  coverColor: string
  updatedAt: string // ISO timestamp of the most recent chapter drop
  newChapters: number // unread chapters since the reader last opened the story
  stats: StoryStats
  chapters: Chapter[]
}

// ---- Analytics --------------------------------------------------------------

/**
 * Per-story analytics, author-only. Backed by real aggregate queries against
 * `read_events`/`comments`/likes/follows (Supabase) or their local-storage
 * equivalents (local) — never fabricated from a hash. See
 * `src/lib/story-analytics.ts` (deleted once this ships) and Phase 8 of the
 * project plan.
 */
export interface StoryAnalytics {
  totalReads: number
  likes: number
  comments: number
  subscribers: number
  completionRate: number // 0..1 — completed / started read_events
  readsByChapter: { label: string; value: number }[]
  readsLast30: number[] // one entry per day, oldest first
  topPassages: { chapter: number; paragraph: number; likes: number }[]
}

// ---- Comments ---------------------------------------------------------------

export interface CommentReply {
  id: string
  authorId: string
  author?: ProfileSummary
  body: string
  createdAt: number
}

export interface Comment {
  id: string
  authorId: string
  author?: ProfileSummary
  body: string
  createdAt: number
  replies: CommentReply[]
}

/** One comment or reply authored by a given person, across all anchors. */
export interface AuthoredComment {
  body: string
  at: number
  anchor: string
  isReply: boolean
}

export interface ChapterCommentCounts {
  chapter: number
  paragraphs: Record<number, number>
}

// ---- Reading ------------------------------------------------------------

/** Per-story reading progress. Replaces the old single global `activeRead` record. */
export interface ReadingProgress {
  storyId: string // story slug
  chapterNumber: number
  completed: boolean
  updatedAt: number
}

export interface InProgressRead extends ReadingProgress {
  story?: Story
}

// ---- Notifications --------------------------------------------------------

export type NotificationType =
  | 'new-chapter'
  | 'comment-reply'
  | 'new-follower'
  | 'story-complete'
  | 'story-liked'
  | 'reads-milestone'

export interface Notification {
  id: string
  type: NotificationType
  at: number
  read: boolean
  actorId?: string
  actor?: ProfileSummary
  storySlug?: string
  chapterNumber?: number
  count?: number
}

// ---- Studio -----------------------------------------------------------------

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
  status: StoryStatus
  chapters: StudioChapter[]
  isNew?: boolean
}

// ---- Auth / accounts --------------------------------------------------------

export type AccountId = 'guest' | 'reader' | 'author'

// ---- Settings (unchanged, not backend-backed) --------------------------------

export type ThemePref = 'light' | 'dark' | 'system'
export type FontSizePref = 'sm' | 'base' | 'lg' | 'xl'
export type LineHeightPref = 'tight' | 'normal' | 'relaxed'

export interface Settings {
  theme: ThemePref
  fontSize: FontSizePref
  lineHeight: LineHeightPref
}
