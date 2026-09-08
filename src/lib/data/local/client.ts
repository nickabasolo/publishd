// LocalDataClient — a faithful, async-wrapped port of the hook bodies that
// used to live directly in src/hooks/*.ts, now behind the DataClient contract.
// Nothing here needs to be async (it's all synchronous localStorage), but the
// interface is async everywhere because the Supabase client will be, and the
// hooks are written once against the interface.
import { COMMENT_SEED, PARAGRAPH_LIKE_SEED } from '@/data/comments-seed'
import { NOTIFICATION_SEED, AUTHOR_NOTIFICATION_TYPES } from '@/data/notifications-seed'
import { currentlyReadingSlugs, likedStorySlugs } from '@/data/demo-state'
import {
  STUDIO_VERSION,
  countWords,
  studioBaseline,
  type StudioChapter as LegacyStudioChapter,
  type StudioStory as LegacyStudioStory,
} from '@/data/studio'
import { readLocal, writeLocal } from '@/lib/storage'
import type { AuthorProfile, Comment as LegacyComment, CommentReply as LegacyCommentReply, FakeStats, User } from '@/lib/types'
import type { DataClient } from '../client'
import { paginate } from './pagination'
import {
  ACCOUNTS,
  defaultFakeStats,
  defaultUser,
  fakeStatsFor,
  getStory,
  resolveProfile,
  stories as seedStories,
  summaryForHandle,
  type AccountId,
} from './seed'
import type {
  AuthoredComment,
  ChapterCommentCounts,
  ChapterState,
  Comment,
  CommentReply,
  InProgressRead,
  Notification,
  Profile,
  ReadingProgress,
  ReadingStats,
  Story,
  StudioStory,
} from '../types'

function uid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function chapterAnchor(slug: string, chapter: number): string {
  return `${slug}/${chapter}`
}
function paragraphAnchor(slug: string, chapter: number, paragraph: number): string {
  return `${slug}/${chapter}/${paragraph}`
}

// ---- current account/user -----------------------------------------------

function currentAccountId(): AccountId {
  return readLocal<AccountId>('account', 'guest')
}

function currentUserRecord(): User {
  const accountId = currentAccountId()
  return readLocal<User>(`user:${accountId}`, ACCOUNTS[accountId].user)
}

function writeCurrentUserRecord(user: User): void {
  writeLocal(`user:${currentAccountId()}`, user)
}

function toProfile(user: User): Profile {
  const authoredSlugs = seedStories.filter((s) => s.authorId === user.username).map((s) => s.slug)
  const author: AuthorProfile | undefined =
    user.author ?? (authoredSlugs.length > 0 ? { penName: user.displayName, publishedStoryIds: authoredSlugs } : undefined)
  return {
    id: user.username,
    handle: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    bio: user.bio,
    favoriteGenres: user.favoriteGenres,
    isAuthor: Boolean(author),
    author,
  }
}

// ---- comments store ---------------------------------------------------------

interface UserComments {
  comments: Record<string, LegacyComment[]>
  replies: Record<string, LegacyCommentReply[]>
}
const EMPTY_COMMENTS: UserComments = { comments: {}, replies: {} }
const COMMENTS_KEY = 'comments.v2'

function legacyToComment(c: LegacyComment, extraReplies: LegacyCommentReply[]): Comment {
  return {
    id: c.id,
    authorId: c.author.handle,
    author: { id: c.author.handle, handle: c.author.handle, displayName: c.author.name, avatarColor: c.author.avatarColor },
    body: c.body,
    createdAt: c.createdAt,
    replies: [...c.replies, ...extraReplies].map(
      (r): CommentReply => ({
        id: r.id,
        authorId: r.author.handle,
        author: { id: r.author.handle, handle: r.author.handle, displayName: r.author.name, avatarColor: r.author.avatarColor },
        body: r.body,
        createdAt: r.createdAt,
      }),
    ),
  }
}

function listCommentsRaw(anchor: string): Comment[] {
  const store = readLocal<UserComments>(COMMENTS_KEY, EMPTY_COMMENTS)
  const base = [...(COMMENT_SEED[anchor] ?? []), ...(store.comments[anchor] ?? [])]
  return base.map((c) => legacyToComment(c, store.replies[c.id] ?? []))
}

function allCommentAnchors(): Set<string> {
  const store = readLocal<UserComments>(COMMENTS_KEY, EMPTY_COMMENTS)
  return new Set([...Object.keys(COMMENT_SEED), ...Object.keys(store.comments)])
}

// ---- reading progress store -----------------------------------------------

interface LegacyActiveRead {
  slug: string
  chapterNumber: number
  completed: boolean
}

const READING_KEY = 'readingProgress.v1'
const LEGACY_ACTIVE_READ_KEY = 'activeRead'

function latestReadableChapterNumber(story: Story): number {
  const readable = story.chapters.filter((c) => !c.locked)
  return (readable[readable.length - 1] ?? story.chapters[0])?.number ?? 1
}

function loadReadingProgress(): Record<string, ReadingProgress> {
  const existing = readLocal<Record<string, ReadingProgress> | null>(READING_KEY, null)
  if (existing) return existing

  // First run: migrate the old single-record `activeRead` key, and seed the
  // same illustrative "currently reading" rows the demo array used to fake,
  // so an existing session's Library looks the same right after this ports.
  const seeded: Record<string, ReadingProgress> = {}
  let t = Date.now() - 1000 * currentlyReadingSlugs.length
  for (const slug of currentlyReadingSlugs) {
    const story = getStory(slug)
    if (!story) continue
    seeded[slug] = { storyId: slug, chapterNumber: latestReadableChapterNumber(story), completed: false, updatedAt: t }
    t += 1000
  }
  const legacy = readLocal<LegacyActiveRead | null>(LEGACY_ACTIVE_READ_KEY, null)
  if (legacy) {
    seeded[legacy.slug] = {
      storyId: legacy.slug,
      chapterNumber: legacy.chapterNumber,
      completed: legacy.completed,
      updatedAt: Date.now(),
    }
  }
  writeLocal(READING_KEY, seeded)
  return seeded
}

function saveReadingProgress(map: Record<string, ReadingProgress>): void {
  writeLocal(READING_KEY, map)
}

// ---- studio store -----------------------------------------------------------

interface StudioSnapshot {
  v: number
  stories: LegacyStudioStory[]
}
const EMPTY_STUDIO_SNAPSHOT: StudioSnapshot = { v: 0, stories: [] }

function studioKey(handle: string): string {
  return `studio:${handle}`
}

function loadStudioStories(handle: string): LegacyStudioStory[] {
  const snap = readLocal<StudioSnapshot>(studioKey(handle), EMPTY_STUDIO_SNAPSHOT)
  if (snap.v === STUDIO_VERSION) return snap.stories
  const fresh = studioBaseline(handle)
  writeLocal(studioKey(handle), { v: STUDIO_VERSION, stories: fresh })
  return fresh
}

function saveStudioStories(handle: string, stories: LegacyStudioStory[]): void {
  writeLocal(studioKey(handle), { v: STUDIO_VERSION, stories })
}

function mutateStudio(handle: string, fn: (list: LegacyStudioStory[]) => LegacyStudioStory[]): LegacyStudioStory[] {
  const next = fn(loadStudioStories(handle))
  saveStudioStories(handle, next)
  return next
}

function mutateStudioChapter(
  handle: string,
  slug: string,
  chapterId: string,
  fn: (c: LegacyStudioChapter) => LegacyStudioChapter,
): void {
  mutateStudio(handle, (list) =>
    list.map((s) => (s.slug === slug ? { ...s, chapters: s.chapters.map((c) => (c.id === chapterId ? fn(c) : c)) } : s)),
  )
}

// ---- the client ---------------------------------------------------------

export const localDataClient: DataClient = {
  stories: {
    async feed(params) {
      const byRecency = [...seedStories].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      if (!params.following) return paginate(byRecency, params)
      const following = new Set(params.following)
      const likedSlugs = new Set(readLocal<string[]>('likes', likedStorySlugs))
      const filtered = byRecency.filter((s) => following.has(s.authorId) || likedSlugs.has(s.slug))
      return paginate(filtered, params)
    },
    async getBySlug(slug) {
      return getStory(slug) ?? null
    },
    async byTag(tag, params) {
      const t = tag.toLowerCase()
      const matches = seedStories.filter((s) => s.tags.some((x) => x.toLowerCase() === t))
      return paginate(matches, params)
    },
    async search(query, params) {
      const q = query.trim().toLowerCase()
      if (!q) return { items: [], nextCursor: null }
      const matches = seedStories.filter((s) =>
        [s.title, s.author?.displayName ?? '', s.authorId, s.blurb, ...s.tags].join(' ').toLowerCase().includes(q),
      )
      return paginate(matches, params)
    },
    async allTags() {
      const counts = new Map<string, number>()
      for (const s of seedStories) {
        for (const tag of s.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
      return [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    },
    // Real local data, not hash-fabrication (see src/lib/story-analytics.ts,
    // deleted once callers are repointed here). The local backend is a
    // single-account demo with no real cross-reader traffic, so a few
    // fields are honestly limited rather than invented:
    //  - totalReads/likes/comments start from the story's real seed stats
    //    (`stats.hits/likes/comments`, authored demo content — not a hash)
    //    plus whatever the current local session has actually added
    //    (a toggled like, locally posted comments).
    //  - subscribers reflects only the current local user's own follow
    //    toggle — there is no other "reader" in a single-account demo.
    //  - readsByChapter/readsLast30 have no real per-chapter or per-day
    //    breakdown in local storage, so the real total is spread evenly
    //    rather than perturbed with random-looking hash noise.
    //  - topPassages comes from the real seeded paragraph-like data
    //    (PARAGRAPH_LIKE_SEED), same as before, minus the hash fallback.
    // Author-only: resolves to null unless the current local account owns
    // a Studio story at this slug.
    async getAnalytics(slug) {
      const owned = loadStudioStories(currentUserRecord().username).some((s) => s.slug === slug)
      if (!owned) return null

      const story = getStory(slug)
      const chapters = story?.chapters ?? []

      const localLiked = readLocal<string[]>('likes', likedStorySlugs).includes(slug)
      const likes = (story?.stats.likes ?? 0) + (localLiked && !likedStorySlugs.includes(slug) ? 1 : 0)

      // listCommentsRaw already merges seeded + locally-posted comments for
      // an anchor, so summing every anchor for this story is the real total
      // — no separate addition of `story.stats.comments` needed (that would
      // double-count the seeded half).
      let comments = 0
      for (const c of chapters) {
        comments += listCommentsRaw(chapterAnchor(slug, c.number)).reduce((n, c2) => n + 1 + c2.replies.length, 0)
        c.paragraphs.forEach((_, i) => {
          comments += listCommentsRaw(paragraphAnchor(slug, c.number, i)).reduce((n, c2) => n + 1 + c2.replies.length, 0)
        })
      }

      const subscribers = readLocal<string[]>('storyFollows', []).includes(slug) ? 1 : 0

      const totalReads = story?.stats.hits ?? 0
      const chapterCount = Math.max(chapters.length, 1)
      const readsByChapter = chapters.length
        ? chapters.map((c) => ({ label: `${c.number}`, value: Math.round(totalReads / chapterCount) }))
        : []
      const readsLast30 = Array.from({ length: 30 }, () => Math.round(totalReads / 30))

      const progress = loadReadingProgress()[slug]
      const completionRate = progress
        ? progress.completed
          ? 1
          : Math.min(1, (progress.chapterNumber ?? 1) / chapterCount)
        : 0

      const topPassages = Object.entries(PARAGRAPH_LIKE_SEED)
        .filter(([k]) => k.startsWith(`${slug}/`))
        .map(([k, likeCount]) => {
          const [, chapter, paragraph] = k.split('/')
          return { chapter: Number(chapter), paragraph: Number(paragraph), likes: likeCount }
        })
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 4)

      return {
        totalReads,
        likes,
        comments,
        subscribers,
        completionRate,
        readsByChapter,
        readsLast30,
        topPassages,
      }
    },
  },

  chapters: {
    async get(slug, number) {
      const story = getStory(slug)
      return story?.chapters.find((c) => c.number === number) ?? null
    },
  },

  comments: {
    async list(anchor, params) {
      return paginate(listCommentsRaw(anchor), params)
    },
    async count(anchor) {
      return listCommentsRaw(anchor).reduce((n, c) => n + 1 + c.replies.length, 0)
    },
    async countsForChapter(slug, chapterNumber): Promise<ChapterCommentCounts> {
      const story = getStory(slug)
      const paragraphs: Record<number, number> = {}
      if (story) {
        const chapter = story.chapters.find((c) => c.number === chapterNumber)
        chapter?.paragraphs.forEach((_, i) => {
          const n = listCommentsRaw(paragraphAnchor(slug, chapterNumber, i)).reduce((n, c) => n + 1 + c.replies.length, 0)
          if (n > 0) paragraphs[i] = n
        })
      }
      const chapterCount = listCommentsRaw(chapterAnchor(slug, chapterNumber)).reduce((n, c) => n + 1 + c.replies.length, 0)
      return { chapter: chapterCount, paragraphs }
    },
    async mine(handle, params) {
      const out: AuthoredComment[] = []
      for (const anchor of allCommentAnchors()) {
        for (const c of listCommentsRaw(anchor)) {
          if (c.authorId === handle) out.push({ body: c.body, at: c.createdAt, anchor, isReply: false })
          for (const r of c.replies) {
            if (r.authorId === handle) out.push({ body: r.body, at: r.createdAt, anchor, isReply: true })
          }
        }
      }
      out.sort((a, b) => b.at - a.at)
      return paginate(out, params)
    },
    async add(anchor, body) {
      const text = body.trim()
      const user = currentUserRecord()
      const comment: LegacyComment = {
        id: uid(),
        author: { name: user.displayName, handle: user.username, avatarColor: user.avatarColor },
        body: text,
        createdAt: Date.now(),
        replies: [],
      }
      const store = readLocal<UserComments>(COMMENTS_KEY, EMPTY_COMMENTS)
      writeLocal(COMMENTS_KEY, {
        ...store,
        comments: { ...store.comments, [anchor]: [...(store.comments[anchor] ?? []), comment] },
      })
      return legacyToComment(comment, [])
    },
    async reply(commentId, body) {
      const text = body.trim()
      const user = currentUserRecord()
      const reply: LegacyCommentReply = {
        id: uid(),
        author: { name: user.displayName, handle: user.username, avatarColor: user.avatarColor },
        body: text,
        createdAt: Date.now(),
      }
      const store = readLocal<UserComments>(COMMENTS_KEY, EMPTY_COMMENTS)
      writeLocal(COMMENTS_KEY, {
        ...store,
        replies: { ...store.replies, [commentId]: [...(store.replies[commentId] ?? []), reply] },
      })
      return {
        id: reply.id,
        authorId: reply.author.handle,
        author: { id: reply.author.handle, handle: reply.author.handle, displayName: reply.author.name, avatarColor: reply.author.avatarColor },
        body: reply.body,
        createdAt: reply.createdAt,
      }
    },
  },

  likes: {
    story: {
      async has(slug) {
        return readLocal<string[]>('likes', likedStorySlugs).includes(slug)
      },
      async toggle(slug) {
        const cur = readLocal<string[]>('likes', likedStorySlugs)
        const has = cur.includes(slug)
        const next = has ? cur.filter((s) => s !== slug) : [...cur, slug]
        writeLocal('likes', next)
        return !has
      },
      async mine() {
        return readLocal<string[]>('likes', likedStorySlugs)
      },
    },
    paragraph: {
      async has(anchor) {
        return readLocal<string[]>('paragraphLikes', []).includes(anchor)
      },
      async baseCount(anchor) {
        return PARAGRAPH_LIKE_SEED[anchor] ?? 0
      },
      async toggle(anchor) {
        const cur = readLocal<string[]>('paragraphLikes', [])
        const has = cur.includes(anchor)
        const next = has ? cur.filter((a) => a !== anchor) : [...cur, anchor]
        writeLocal('paragraphLikes', next)
        return !has
      },
      async forChapter(slug, chapterNumber) {
        const story = getStory(slug)
        const liked = readLocal<string[]>('paragraphLikes', [])
        const result: Record<number, { liked: boolean; total: number }> = {}
        const chapter = story?.chapters.find((c) => c.number === chapterNumber)
        chapter?.paragraphs.forEach((_, i) => {
          const anchor = paragraphAnchor(slug, chapterNumber, i)
          const isLiked = liked.includes(anchor)
          result[i] = { liked: isLiked, total: (PARAGRAPH_LIKE_SEED[anchor] ?? 0) + (isLiked ? 1 : 0) }
        })
        return result
      },
      async mine() {
        return readLocal<string[]>('paragraphLikes', [])
      },
    },
  },

  follows: {
    story: {
      async isFollowing(slug) {
        return readLocal<string[]>('storyFollows', []).includes(slug)
      },
      async toggle(slug) {
        const cur = readLocal<string[]>('storyFollows', [])
        const has = cur.includes(slug)
        writeLocal('storyFollows', has ? cur.filter((s) => s !== slug) : [...cur, slug])
        return !has
      },
    },
    author: {
      async isFollowing(handle) {
        return readLocal<string[]>('follows', []).includes(handle)
      },
      async toggle(handle) {
        const cur = readLocal<string[]>('follows', [])
        const has = cur.includes(handle)
        writeLocal('follows', has ? cur.filter((h) => h !== handle) : [...cur, handle])
        return !has
      },
      async mine() {
        return readLocal<string[]>('follows', [])
      },
    },
  },

  reading: {
    async getProgress(storyId) {
      return loadReadingProgress()[storyId] ?? null
    },
    async inProgress(params) {
      const map = loadReadingProgress()
      const items: InProgressRead[] = Object.values(map)
        .filter((p) => !p.completed)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((p) => ({ ...p, story: getStory(p.storyId) }))
      return paginate(items, params)
    },
    async startChapter(storyId, chapterNumber) {
      const map = loadReadingProgress()
      const cur = map[storyId]
      const next: ReadingProgress =
        cur && cur.chapterNumber === chapterNumber
          ? cur
          : { storyId, chapterNumber, completed: false, updatedAt: Date.now() }
      saveReadingProgress({ ...map, [storyId]: next })
      return next
    },
    async completeChapter(storyId, chapterNumber) {
      const map = loadReadingProgress()
      const cur = map[storyId]
      const next: ReadingProgress =
        cur && cur.chapterNumber === chapterNumber && !cur.completed
          ? { ...cur, completed: true, updatedAt: Date.now() }
          : (cur ?? { storyId, chapterNumber, completed: true, updatedAt: Date.now() })
      saveReadingProgress({ ...map, [storyId]: next })
      return next
    },
    async dismiss(storyId) {
      const map = loadReadingProgress()
      const cur = map[storyId]
      if (cur && !cur.completed) saveReadingProgress({ ...map, [storyId]: { ...cur, completed: true, updatedAt: Date.now() } })
    },
  },

  notifications: {
    async list(params) {
      const user = currentUserRecord()
      const isAuthor = seedStories.some((s) => s.authorId === user.username)
      const readIds = readLocal<string[]>('notifications.read', [])
      const items: Notification[] = NOTIFICATION_SEED.filter((n) => isAuthor || !AUTHOR_NOTIFICATION_TYPES.includes(n.type))
        .map((n) => ({
          id: n.id,
          type: n.type,
          at: n.at,
          read: readIds.includes(n.id),
          actorId: n.actorHandle,
          actor: summaryForHandle(n.actorHandle),
          storySlug: n.storySlug,
          chapterNumber: n.chapterNumber,
          count: n.count,
        }))
        .sort((a, b) => b.at - a.at)
      return paginate(items, params)
    },
    async unreadCount() {
      const { items } = await localDataClient.notifications.list({ limit: NOTIFICATION_SEED.length })
      return items.reduce((n, it) => n + (it.read ? 0 : 1), 0)
    },
    async markRead(id) {
      const cur = readLocal<string[]>('notifications.read', [])
      if (!cur.includes(id)) writeLocal('notifications.read', [...cur, id])
    },
    async markAllRead() {
      writeLocal('notifications.read', NOTIFICATION_SEED.map((n) => n.id))
    },
  },

  studio: {
    async listMine() {
      return loadStudioStories(currentUserRecord().username) as unknown as StudioStory[]
    },
    async getBySlug(slug) {
      const list = loadStudioStories(currentUserRecord().username)
      return (list.find((s) => s.slug === slug) as unknown as StudioStory) ?? null
    },
    async createStory() {
      const slug = `draft-${uid().slice(0, 8)}`
      mutateStudio(currentUserRecord().username, (list) => [
        {
          slug,
          title: 'Untitled story',
          blurb: '',
          synopsis: '',
          tags: [],
          coverColor: '#6366f1',
          status: 'ongoing',
          chapters: [],
          isNew: true,
        },
        ...list,
      ])
      return slug
    },
    async updateStory(slug, patch) {
      mutateStudio(currentUserRecord().username, (list) =>
        list.map((s) => (s.slug === slug ? { ...s, ...(patch as Partial<LegacyStudioStory>) } : s)),
      )
    },
    async addChapter(slug) {
      const id = uid()
      mutateStudio(currentUserRecord().username, (list) =>
        list.map((s) =>
          s.slug === slug
            ? {
                ...s,
                chapters: [
                  ...s.chapters,
                  {
                    id,
                    number: s.chapters.length + 1,
                    title: 'Untitled chapter',
                    body: '',
                    state: 'draft' as ChapterState,
                    locked: false,
                    wordCount: 0,
                  },
                ],
              }
            : s,
        ),
      )
      return id
    },
    async updateChapter(slug, chapterId, patch) {
      mutateStudioChapter(currentUserRecord().username, slug, chapterId, (c) => {
        const next = { ...c, ...(patch as Partial<LegacyStudioChapter>) }
        if (patch.body !== undefined) next.wordCount = countWords(patch.body)
        return next
      })
    },
    async setChapterState(slug, chapterId, state) {
      mutateStudioChapter(currentUserRecord().username, slug, chapterId, (c) => ({
        ...c,
        state,
        scheduledAt: state === 'scheduled' ? c.scheduledAt : undefined,
      }))
    },
    async scheduleChapter(slug, chapterId, at) {
      mutateStudioChapter(currentUserRecord().username, slug, chapterId, (c) => ({ ...c, state: 'scheduled', scheduledAt: at }))
    },
    async setPaywall(slug, chapterId, locked) {
      mutateStudioChapter(currentUserRecord().username, slug, chapterId, (c) => ({ ...c, locked }))
    },
    async deleteChapter(slug, chapterId) {
      mutateStudio(currentUserRecord().username, (list) =>
        list.map((s) =>
          s.slug === slug
            ? {
                ...s,
                chapters: s.chapters.filter((c) => c.id !== chapterId).map((c, i) => ({ ...c, number: i + 1 })),
              }
            : s,
        ),
      )
    },
  },

  profiles: {
    async getByHandle(handle) {
      const me = currentUserRecord()
      if (handle === me.username) return toProfile(me)
      return resolveProfile(handle)
    },
    async getMe() {
      return toProfile(currentUserRecord())
    },
    async updateMe(patch) {
      const cur = currentUserRecord()
      const next: User = {
        ...cur,
        displayName: patch.displayName ?? cur.displayName,
        username: patch.handle ?? cur.username,
        avatarColor: patch.avatarColor ?? cur.avatarColor,
        bio: patch.bio ?? cur.bio,
        favoriteGenres: patch.favoriteGenres ?? cur.favoriteGenres,
      }
      writeCurrentUserRecord(next)
      return toProfile(next)
    },
    async getStats(handle) {
      const me = currentUserRecord()
      if (handle === me.username) {
        return readLocal<FakeStats>(`fakeStats:${currentAccountId()}`, ACCOUNTS[currentAccountId()].stats)
      }
      return fakeStatsFor(handle)
    },
    async getMyStats() {
      const accountId = currentAccountId()
      return readLocal<FakeStats>(`fakeStats:${accountId}`, ACCOUNTS[accountId].stats)
    },
    async updateMyStats(patch) {
      const accountId = currentAccountId()
      const cur = readLocal<FakeStats>(`fakeStats:${accountId}`, ACCOUNTS[accountId].stats)
      const next: FakeStats = { ...cur, ...(patch as Partial<FakeStats>) }
      writeLocal(`fakeStats:${accountId}`, next)
      return next as ReadingStats
    },
  },

  auth: {
    async getAccountId() {
      return currentAccountId()
    },
    async switchAccount(id) {
      writeLocal('account', id)
    },
  },
}

// Re-exported so callers that only need default seed values (rare) don't
// have to reach into src/data directly.
export { defaultFakeStats, defaultUser }
