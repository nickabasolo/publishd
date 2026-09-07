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
  actorHandle?: string
  storySlug?: string
  chapterNumber?: number
  count?: number
}

// Author-oriented types — only shown when the active user actually authors a story.
export const AUTHOR_NOTIFICATION_TYPES: NotificationType[] = [
  'new-follower',
  'story-liked',
  'reads-milestone',
]

const NOW = new Date('2026-09-06T09:00:00Z').getTime()
const H = 3600 * 1000
const D = 24 * H

// Newest first isn't required here — the hook sorts by `at`.
export const NOTIFICATION_SEED: Notification[] = [
  {
    id: 'n-1',
    type: 'new-chapter',
    at: NOW - 2 * H,
    actorHandle: 'maravance',
    storySlug: 'the-salt-cathedral',
    chapterNumber: 5,
  },
  {
    id: 'n-2',
    type: 'comment-reply',
    at: NOW - 6 * H,
    actorHandle: 'fenwick',
    storySlug: 'the-salt-cathedral',
    chapterNumber: 5,
  },
  {
    id: 'n-3',
    type: 'new-follower',
    at: NOW - 20 * H,
    actorHandle: 'catoreads',
  },
  {
    id: 'n-4',
    type: 'story-liked',
    at: NOW - 26 * H,
    actorHandle: 'delphine',
    storySlug: 'paper-moons',
  },
  {
    id: 'n-5',
    type: 'new-chapter',
    at: NOW - 2 * D,
    actorHandle: 'inesbrandt',
    storySlug: 'the-cartographer-of-small-rooms',
    chapterNumber: 3,
  },
  {
    id: 'n-6',
    type: 'reads-milestone',
    at: NOW - 3 * D,
    storySlug: 'the-salt-cathedral',
    count: 10000,
  },
  {
    id: 'n-7',
    type: 'story-complete',
    at: NOW - 4 * D,
    storySlug: 'groundwater',
  },
  {
    id: 'n-8',
    type: 'comment-reply',
    at: NOW - 5 * D,
    actorHandle: 'mothlight',
    storySlug: 'the-long-wednesday',
    chapterNumber: 1,
  },
]
