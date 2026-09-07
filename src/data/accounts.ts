import { defaultUser, defaultFakeStats } from '@/data/default-user'
import type { FakeStats, User } from '@/lib/types'

export type AccountId = 'guest' | 'reader' | 'author'

export interface Account {
  id: AccountId
  label: string
  user: User
  stats: FakeStats
}

// Fake accounts the prototype banner switches between. Same app either way —
// Guest is signed out; the author account already has published work.
const guestUser: User = {
  id: 'acct-guest',
  username: 'guest',
  displayName: 'Guest',
  avatarColor: '#94a3b8',
  bio: '',
  favoriteGenres: [],
}

const guestStats: FakeStats = {
  booksRead: 0,
  chaptersRead: 0,
  minutesRead: 0,
  dayStreak: 0,
}

const authorUser: User = {
  id: 'acct-author',
  username: 'maravance',
  displayName: 'Mara Vance',
  avatarColor: '#6366f1', // matches her stories.json byline
  bio: 'Writing The Salt Cathedral and two others. New chapters most Fridays.',
  favoriteGenres: ['Fantasy', 'Literary', 'Horror'],
}

const authorStats: FakeStats = {
  booksRead: 61,
  chaptersRead: 540,
  minutesRead: 9200,
  dayStreak: 31,
}

export const ACCOUNTS: Record<AccountId, Account> = {
  guest: { id: 'guest', label: 'Guest', user: guestUser, stats: guestStats },
  reader: { id: 'reader', label: 'Reader', user: defaultUser, stats: defaultFakeStats },
  author: { id: 'author', label: 'Author', user: authorUser, stats: authorStats },
}
