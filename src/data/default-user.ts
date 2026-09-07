import type { User, FakeStats } from '@/lib/types'

export const AVATAR_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#f59e0b',
  '#f43f5e',
  '#a855f7',
  '#3b82f6',
]

export const GENRE_OPTIONS = [
  'Fantasy',
  'Sci-Fi',
  'Mystery',
  'Thriller',
  'Romance',
  'Literary',
  'Horror',
  'Historical',
  'Comedy',
  'Adventure',
]

export const defaultUser: User = {
  id: 'local-user',
  username: 'readerlyn',
  displayName: 'Reader Lyn',
  avatarColor: '#6366f1',
  bio: 'Serial subscriber. Currently rationing three ongoing stories so they last.',
  favoriteGenres: ['Fantasy', 'Sci-Fi', 'Mystery'],
}

// Faked, hand-tunable in Settings → "Adjust demo values".
export const defaultFakeStats: FakeStats = {
  booksRead: 24,
  chaptersRead: 312,
  minutesRead: 4180,
  dayStreak: 17,
}
