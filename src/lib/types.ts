// Shared by ALL users. An "author" is just a User with `author` populated —
// that extension is forward-looking and unused in this pass.
export interface AuthorProfile {
  penName: string
  publishedStoryIds: string[]
}

export interface User {
  id: string
  username: string
  displayName: string
  avatarColor: string
  bio: string
  favoriteGenres: string[]
  author?: AuthorProfile
}

export interface FakeStats {
  booksRead: number
  chaptersRead: number
  minutesRead: number
  dayStreak: number
}

// Story byline — static data from stories.json, not a Publishd account.
export interface Author {
  name: string
  handle: string
  avatarColor: string
}

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
  author: Author
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

export type Persona = 'reader' | 'author'

export type ThemePref = 'light' | 'dark' | 'system'
export type FontSizePref = 'sm' | 'base' | 'lg' | 'xl'
export type LineHeightPref = 'tight' | 'normal' | 'relaxed'

export interface Settings {
  theme: ThemePref
  fontSize: FontSizePref
  lineHeight: LineHeightPref
}
