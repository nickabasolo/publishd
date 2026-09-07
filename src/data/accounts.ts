import { defaultUser, defaultFakeStats } from '@/data/default-user'
import type { FakeStats, User } from '@/lib/types'

export type AccountId = 'reader' | 'author'

export interface Account {
  id: AccountId
  label: string
  user: User
  stats: FakeStats
}

// Two fake accounts the prototype banner switches between. Same app either way —
// the author account just already has published work.
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
  reader: { id: 'reader', label: 'Reader', user: defaultUser, stats: defaultFakeStats },
  author: { id: 'author', label: 'Author', user: authorUser, stats: authorStats },
}
