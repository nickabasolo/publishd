import type { Comment, CommentAuthor } from '@/lib/types'

// Fake commenter personas.
const A: Record<string, CommentAuthor> = {
  fenwick: { name: 'Fen Wick', handle: 'fenwick', avatarColor: '#0ea5e9' },
  moth: { name: 'Moth', handle: 'mothlight', avatarColor: '#a855f7' },
  cato: { name: 'Cato R.', handle: 'catoreads', avatarColor: '#f59e0b' },
  brine: { name: 'Brine', handle: 'saltbrine', avatarColor: '#14b8a6' },
  del: { name: 'Del', handle: 'delphine', avatarColor: '#f43f5e' },
}

// Recurring commenters, keyed by handle — consumed by the people registry.
export const COMMENT_PERSONAS: Record<string, CommentAuthor> = Object.fromEntries(
  Object.values(A).map((p) => [p.handle, p]),
)

const H = 3600 * 1000
const D = 24 * H
// Anchor to the prototype's pinned "now" (see lib/format.ts).
const NOW = new Date('2026-09-06T09:00:00Z').getTime()

/**
 * Anchor key format: `${slug}/${chapter}` for a chapter thread,
 * `${slug}/${chapter}/${paragraphIndex}` for a paragraph thread.
 */
// Placeholder bodies — intentionally lorem ipsum so the text doesn't read as
// real commentary during prototype reviews.
const LI = {
  short: 'Lorem ipsum dolor sit amet.',
  mid: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  long: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
}

export const COMMENT_SEED: Record<string, Comment[]> = {
  'the-salt-cathedral/5': [
    {
      id: 'seed-c1',
      author: A.brine,
      body: LI.long,
      createdAt: NOW - 5 * H,
      replies: [
        {
          id: 'seed-c1-r1',
          author: A.moth,
          body: LI.short,
          createdAt: NOW - 4 * H,
        },
      ],
    },
    {
      id: 'seed-c2',
      author: A.cato,
      body: LI.mid,
      createdAt: NOW - 2 * D,
      replies: [],
    },
  ],
  'the-salt-cathedral/5/1': [
    {
      id: 'seed-p1-c1',
      author: A.fenwick,
      body: LI.mid,
      createdAt: NOW - 6 * H,
      replies: [
        {
          id: 'seed-p1-c1-r1',
          author: A.del,
          body: LI.short,
          createdAt: NOW - 3 * H,
        },
      ],
    },
  ],
  'the-salt-cathedral/5/3': [
    {
      id: 'seed-p3-c1',
      author: A.moth,
      body: LI.mid,
      createdAt: NOW - 30 * H,
      replies: [],
    },
  ],
  'paper-moons/2': [
    {
      id: 'seed-pm-c1',
      author: A.del,
      body: LI.long,
      createdAt: NOW - 18 * H,
      replies: [],
    },
  ],
}

// Baseline like counts for paragraph anchors (the reader's own like adds +1 on top).
export const PARAGRAPH_LIKE_SEED: Record<string, number> = {
  'the-salt-cathedral/5/0': 12,
  'the-salt-cathedral/5/1': 41,
  'the-salt-cathedral/5/3': 7,
  'paper-moons/2/0': 9,
  'paper-moons/2/2': 23,
}
