// SupabaseDataClient — Phase 2: read paths + auth.
//
// Scope (per the Phase 2 task): stories.feed/getBySlug/byTag/search/allTags,
// chapters.get, comments.list/count/countsForChapter/mine, profiles.getByHandle,
// notifications.list/unreadCount/markRead/markAllRead, and auth.getAccountId.
// Everything else (comments.add/reply, likes.*.toggle, follows.*.toggle,
// reading.*, studio.*, profiles.updateMe/getStats/updateMyStats,
// auth.switchAccount) is Phase 3 (writes) and still throws via `notImplemented`.
//
// IMPORTANT: none of this has been run against the live database — see the
// handoff report for why (no anon key configured in this environment) and
// exactly what to check once one is filled in.
import type { DataClient } from '../client'
import type {
  ChapterCommentCounts,
  Comment,
  Notification,
  Page,
  Profile,
  ProfileSummary,
  Story,
} from '../types'
import { getSession } from './auth'
import {
  toChapter,
  toComment,
  toNotification,
  toProfile,
  toProfileSummary,
  toStory,
  type ChapterRow,
  type CommentAuthorRow,
  type CommentRow,
  type NotificationRow,
  type ParagraphRow,
  type ProfileRow,
  type StoryRow,
} from './mappers'
import { decodeOffset, emptyPage, fetchPage } from './pagination'
import { supabase } from './supabase-browser'

function notImplemented(method: string): never {
  throw new Error(
    `[data/supabase] "${method}" is not implemented yet — writes land in Phase 3. ` +
      `Set VITE_DATA_BACKEND=local (the default) until then.`,
  )
}

function stubResource<T extends object>(name: string, methods: (keyof T)[]): T {
  const stub = {} as Record<string, unknown>
  for (const m of methods) stub[m as string] = () => notImplemented(`${name}.${String(m)}`)
  return stub as T
}

const COMMENT_AUTHOR_SELECT = 'id, username, display_name, avatar_color'
const COMMENT_SELECT = `id, author_id, body, created_at, deleted_at, author:profiles(${COMMENT_AUTHOR_SELECT}), replies:comments!parent_id(id, author_id, body, created_at, deleted_at, author:profiles(${COMMENT_AUTHOR_SELECT}))`

// ---- shared lookups -------------------------------------------------------

async function currentUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.user.id ?? null
}

async function getStoryRowBySlug(slug: string): Promise<StoryRow | null> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, slug, author_id, title, blurb, synopsis, cover_color, status, is_published, updated_at')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Resolves a `slug/chapterNumber[/paragraphOrdinal]` anchor to real ids. Returns null if the chapter/paragraph doesn't exist or isn't visible to the caller (RLS handles the visibility check). */
async function resolveAnchor(
  anchor: string,
): Promise<{ chapterId: string; paragraphId: string | null } | null> {
  const [slug, chapterNumberStr, paragraphOrdinalStr] = anchor.split('/')
  const chapterNumber = Number(chapterNumberStr)
  const story = await getStoryRowBySlug(slug)
  if (!story) return null

  const { data: chapter, error: chErr } = await supabase
    .from('chapters')
    .select('id')
    .eq('story_id', story.id)
    .eq('number', chapterNumber)
    .eq('state', 'published')
    .eq('hidden', false)
    .maybeSingle()
  if (chErr) throw chErr
  if (!chapter) return null

  if (paragraphOrdinalStr === undefined) return { chapterId: chapter.id, paragraphId: null }

  const { data: paragraph, error: pErr } = await supabase
    .from('paragraphs')
    .select('id')
    .eq('chapter_id', chapter.id)
    .eq('ordinal', Number(paragraphOrdinalStr))
    .is('deleted_at', null)
    .maybeSingle()
  if (pErr) throw pErr
  if (!paragraph) return null

  return { chapterId: chapter.id, paragraphId: paragraph.id }
}

async function fetchAuthorSummary(authorId: string): Promise<ProfileSummary | undefined> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_color')
    .eq('id', authorId)
    .maybeSingle()
  if (error) throw error
  return toProfileSummary(data as CommentAuthorRow | null)
}

async function fetchStoryTags(storyId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('story_tags')
    .select('tag:tags(slug)')
    .eq('story_id', storyId)
  if (error) throw error
  return ((data ?? []) as { tag: { slug: string } | { slug: string }[] | null }[])
    .map((r) => (Array.isArray(r.tag) ? r.tag[0]?.slug : r.tag?.slug))
    .filter((s): s is string => Boolean(s))
}

async function fetchStoryStats(storyId: string): Promise<Story['stats']> {
  const [likes, comments, hits] = await Promise.all([
    supabase.from('story_likes').select('*', { count: 'exact', head: true }).eq('target_id', storyId),
    supabase
      .from('comments')
      .select('id, chapters!inner(story_id)', { count: 'exact', head: true })
      .eq('chapters.story_id', storyId)
      .is('deleted_at', null),
    supabase.from('read_events').select('*', { count: 'exact', head: true }).eq('story_id', storyId),
  ])
  if (likes.error) throw likes.error
  if (comments.error) throw comments.error
  if (hits.error) throw hits.error
  return { likes: likes.count ?? 0, comments: comments.count ?? 0, hits: hits.count ?? 0 }
}

/** Best-effort: 0 for a signed-out caller (no progress to compare against). */
async function fetchNewChapterCount(storyId: string, totalPublished: number): Promise<number> {
  const userId = await currentUserId()
  if (!userId) return 0
  const { data, error } = await supabase
    .from('reading_progress')
    .select('chapter_number')
    .eq('story_id', storyId)
    .eq('profile_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return totalPublished
  const { count, error: cErr } = await supabase
    .from('chapters')
    .select('*', { count: 'exact', head: true })
    .eq('story_id', storyId)
    .eq('state', 'published')
    .eq('hidden', false)
    .gt('number', data.chapter_number ?? 0)
  if (cErr) throw cErr
  return count ?? 0
}

async function buildStory(row: StoryRow, chapterRows: ChapterRow[], paragraphsByChapter: Map<string, ParagraphRow[]>): Promise<Story> {
  const [tags, author, stats] = await Promise.all([
    fetchStoryTags(row.id),
    fetchAuthorSummary(row.author_id),
    fetchStoryStats(row.id),
  ])
  const chapters = chapterRows.map((c) => toChapter(c, paragraphsByChapter.get(c.id) ?? []))
  const newChapters = await fetchNewChapterCount(row.id, chapters.length)
  return toStory(row, { tags, author, chapters, stats, newChapters })
}

async function fetchPublishedChapters(storyId: string): Promise<{ rows: ChapterRow[]; paragraphs: Map<string, ParagraphRow[]> }> {
  const { data: rows, error } = await supabase
    .from('chapters')
    .select('id, number, title, state, hidden, locked, word_count')
    .eq('story_id', storyId)
    .eq('state', 'published')
    .eq('hidden', false)
    .order('number', { ascending: true })
  if (error) throw error
  const chapterRows = (rows ?? []) as ChapterRow[]
  const paragraphs = new Map<string, ParagraphRow[]>()
  if (chapterRows.length > 0) {
    const { data: paras, error: pErr } = await supabase
      .from('paragraphs')
      .select('chapter_id, ordinal, body')
      .in('chapter_id', chapterRows.map((c) => c.id))
      .is('deleted_at', null)
    if (pErr) throw pErr
    for (const p of paras ?? []) {
      const list = paragraphs.get(p.chapter_id) ?? []
      list.push({ ordinal: p.ordinal, body: p.body })
      paragraphs.set(p.chapter_id, list)
    }
  }
  return { rows: chapterRows, paragraphs }
}

async function storiesToPage(rows: StoryRow[], nextCursor: string | null): Promise<Page<Story>> {
  const items = await Promise.all(
    rows.map(async (row) => {
      const { rows: chapterRows, paragraphs } = await fetchPublishedChapters(row.id)
      return buildStory(row, chapterRows, paragraphs)
    }),
  )
  return { items, nextCursor }
}

const STORY_COLUMNS = 'id, slug, author_id, title, blurb, synopsis, cover_color, status, is_published, updated_at'

async function commentAnchorTotal(chapterId: string, paragraphId: string | null): Promise<number> {
  let q = supabase.from('comments').select('*', { count: 'exact', head: true }).eq('chapter_id', chapterId).is('deleted_at', null)
  q = paragraphId ? q.eq('paragraph_id', paragraphId) : q.is('paragraph_id', null)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

export const supabaseDataClient: DataClient = {
  stories: {
    async feed(params) {
      // `following` (a set of author handles the caller follows) isn't
      // something the discover feed filters server-side in Phase 2 — the
      // caller-scoped follow/like union the local adapter fakes needs a
      // dedicated query shape better done as its own pass. Ignored for now;
      // this always returns the public discover feed.
      const offset = decodeOffset(params.cursor)
      const limit = params.limit ?? 20
      const { rows, nextCursor } = await fetchPage<StoryRow>(
        supabase
          .from('stories')
          .select(STORY_COLUMNS)
          .eq('is_published', true)
          .order('updated_at', { ascending: false }),
        { cursor: String(offset), limit },
      )
      return storiesToPage(rows, nextCursor)
    },

    async getBySlug(slug) {
      const row = await getStoryRowBySlug(slug)
      if (!row || (!row.is_published && row.author_id !== (await currentUserId()))) return null
      const { rows: chapterRows, paragraphs } = await fetchPublishedChapters(row.id)
      return buildStory(row, chapterRows, paragraphs)
    },

    async byTag(tag, params) {
      const slug = tag.toLowerCase()
      const { data: tagRow, error: tErr } = await supabase.from('tags').select('id').eq('slug', slug).maybeSingle()
      if (tErr) throw tErr
      if (!tagRow) return emptyPage<Story>()

      const { data: links, error: lErr } = await supabase.from('story_tags').select('story_id').eq('tag_id', tagRow.id)
      if (lErr) throw lErr
      const storyIds = (links ?? []).map((l) => l.story_id)
      if (storyIds.length === 0) return emptyPage<Story>()

      const { rows, nextCursor } = await fetchPage<StoryRow>(
        supabase
          .from('stories')
          .select(STORY_COLUMNS)
          .eq('is_published', true)
          .in('id', storyIds)
          .order('updated_at', { ascending: false }),
        params,
      )
      return storiesToPage(rows, nextCursor)
    },

    async search(query, params) {
      const q = query.trim()
      if (!q) return emptyPage<Story>()
      // Postgres full-text search over the generated `search_vector` column
      // (0008_search.sql), not a client-side substring filter. `plain`
      // tolerates arbitrary user input (no operator syntax to escape).
      const { rows, nextCursor } = await fetchPage<StoryRow>(
        supabase
          .from('stories')
          .select(STORY_COLUMNS)
          .eq('is_published', true)
          .textSearch('search_vector', q, { type: 'plain', config: 'english' })
          .order('updated_at', { ascending: false }),
        params,
      )
      return storiesToPage(rows, nextCursor)
    },

    async allTags() {
      // A tag cloud needs every published story's tags to produce accurate
      // counts — there's no way to page a "top N tags" aggregate without an
      // RPC, so (like the local adapter) this reads the full, but bounded,
      // story_tags/tags/stories join rather than paging.
      const { data, error } = await supabase
        .from('story_tags')
        .select('tag:tags(slug), story:stories!inner(is_published)')
        .eq('story.is_published', true)
      if (error) throw error
      const counts = new Map<string, number>()
      for (const row of (data ?? []) as { tag: { slug: string } | { slug: string }[] | null }[]) {
        const tagSlug = Array.isArray(row.tag) ? row.tag[0]?.slug : row.tag?.slug
        if (!tagSlug) continue
        counts.set(tagSlug, (counts.get(tagSlug) ?? 0) + 1)
      }
      return [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    },
  },

  chapters: {
    async get(slug, number) {
      const story = await getStoryRowBySlug(slug)
      if (!story) return null
      const { data: chapterRow, error } = await supabase
        .from('chapters')
        .select('id, number, title, state, hidden, locked, word_count')
        .eq('story_id', story.id)
        .eq('number', number)
        .eq('state', 'published')
        .eq('hidden', false)
        .maybeSingle()
      if (error) throw error
      if (!chapterRow) return null
      const { data: paras, error: pErr } = await supabase
        .from('paragraphs')
        .select('ordinal, body')
        .eq('chapter_id', chapterRow.id)
        .is('deleted_at', null)
        .order('ordinal', { ascending: true })
      if (pErr) throw pErr
      return toChapter(chapterRow as ChapterRow, (paras ?? []) as ParagraphRow[])
    },
  },

  comments: {
    async list(anchor, params) {
      const resolved = await resolveAnchor(anchor)
      if (!resolved) return emptyPage<Comment>()
      let q = supabase
        .from('comments')
        .select(COMMENT_SELECT)
        .eq('chapter_id', resolved.chapterId)
        .is('parent_id', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      q = resolved.paragraphId ? q.eq('paragraph_id', resolved.paragraphId) : q.is('paragraph_id', null)
      const { rows, nextCursor } = await fetchPage<CommentRow>(q, params)
      return { items: rows.map(toComment), nextCursor }
    },

    async count(anchor) {
      const resolved = await resolveAnchor(anchor)
      if (!resolved) return 0
      return commentAnchorTotal(resolved.chapterId, resolved.paragraphId)
    },

    async countsForChapter(slug, chapterNumber): Promise<ChapterCommentCounts> {
      const story = await getStoryRowBySlug(slug)
      if (!story) return { chapter: 0, paragraphs: {} }
      const { data: chapter, error } = await supabase
        .from('chapters')
        .select('id')
        .eq('story_id', story.id)
        .eq('number', chapterNumber)
        .eq('state', 'published')
        .eq('hidden', false)
        .maybeSingle()
      if (error) throw error
      if (!chapter) return { chapter: 0, paragraphs: {} }

      const { data: paras, error: pErr } = await supabase
        .from('paragraphs')
        .select('id, ordinal')
        .eq('chapter_id', chapter.id)
        .is('deleted_at', null)
      if (pErr) throw pErr

      const [chapterCount, ...paragraphCounts] = await Promise.all([
        commentAnchorTotal(chapter.id, null),
        ...(paras ?? []).map((p) => commentAnchorTotal(chapter.id, p.id)),
      ])

      const paragraphs: Record<number, number> = {}
      ;(paras ?? []).forEach((p, i) => {
        const n = paragraphCounts[i]
        if (n > 0) paragraphs[p.ordinal] = n
      })
      return { chapter: chapterCount, paragraphs }
    },

    async mine(handle, params) {
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', handle)
        .maybeSingle()
      if (pErr) throw pErr
      if (!profile) return emptyPage()

      const { rows, nextCursor } = await fetchPage(
        supabase
          .from('comments')
          .select('id, body, created_at, parent_id, chapter:chapters(number, story:stories(slug)), paragraph:paragraphs(ordinal)')
          .eq('author_id', profile.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        params,
      )
      return {
        items: rows.map((r) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = r as any
          const chapter = Array.isArray(row.chapter) ? row.chapter[0] : row.chapter
          const story = chapter ? (Array.isArray(chapter.story) ? chapter.story[0] : chapter.story) : null
          const paragraph = Array.isArray(row.paragraph) ? row.paragraph[0] : row.paragraph
          const anchor = story
            ? `${story.slug}/${chapter.number}${paragraph ? `/${paragraph.ordinal}` : ''}`
            : ''
          return { body: row.body, at: new Date(row.created_at).getTime(), anchor, isReply: row.parent_id != null }
        }),
        nextCursor,
      }
    },

    add: () => notImplemented('comments.add'),
    reply: () => notImplemented('comments.reply'),
  },

  likes: {
    story: stubResource<DataClient['likes']['story']>('likes.story', ['has', 'toggle', 'mine']),
    paragraph: stubResource<DataClient['likes']['paragraph']>('likes.paragraph', ['has', 'baseCount', 'toggle', 'forChapter', 'mine']),
  },

  follows: {
    story: stubResource<DataClient['follows']['story']>('follows.story', ['isFollowing', 'toggle']),
    author: stubResource<DataClient['follows']['author']>('follows.author', ['isFollowing', 'toggle', 'mine']),
  },

  reading: stubResource<DataClient['reading']>('reading', [
    'getProgress',
    'inProgress',
    'startChapter',
    'completeChapter',
    'dismiss',
  ]),

  notifications: {
    async list(params) {
      const userId = await currentUserId()
      if (!userId) return emptyPage<Notification>()
      const { rows, nextCursor } = await fetchPage<NotificationRow>(
        supabase
          .from('notifications')
          .select(
            'id, type, created_at, read_at, actor_id, story_id, chapter_id, actor:profiles(id, username, display_name, avatar_color), story:stories(slug), chapter:chapters(number)',
          )
          .eq('profile_id', userId)
          .order('created_at', { ascending: false }),
        params,
      )
      return { items: rows.map(toNotification), nextCursor }
    },

    async unreadCount() {
      const userId = await currentUserId()
      if (!userId) return 0
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', userId)
        .is('read_at', null)
      if (error) throw error
      return count ?? 0
    },

    async markRead(id) {
      const userId = await currentUserId()
      if (!userId) return
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('profile_id', userId)
      if (error) throw error
    },

    async markAllRead() {
      const userId = await currentUserId()
      if (!userId) return
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('profile_id', userId)
        .is('read_at', null)
      if (error) throw error
    },
  },

  studio: stubResource<DataClient['studio']>('studio', [
    'listMine',
    'getBySlug',
    'createStory',
    'updateStory',
    'addChapter',
    'updateChapter',
    'setChapterState',
    'scheduleChapter',
    'setPaywall',
    'deleteChapter',
  ]),

  profiles: {
    async getByHandle(handle) {
      const { data: row, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_color, bio, favorite_genres, is_author')
        .ilike('username', handle)
        .maybeSingle()
      if (error) throw error
      if (!row) return null
      return buildProfile(row as ProfileRow)
    },

    async getMe() {
      const userId = await currentUserId()
      if (!userId) {
        // No demo-data fallback exists for a real signed-out session — this
        // is the actual guest identity, analogous to the local adapter's
        // 'guest' account, not a stand-in for a missing record.
        return {
          id: 'guest',
          handle: 'guest',
          displayName: 'Guest',
          avatarColor: '#94a3b8',
          bio: '',
          favoriteGenres: [],
          isAuthor: false,
        }
      }
      const { data: row, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_color, bio, favorite_genres, is_author')
        .eq('id', userId)
        .single()
      if (error) throw error
      return buildProfile(row as ProfileRow)
    },

    updateMe: () => notImplemented('profiles.updateMe'),
    getStats: () => notImplemented('profiles.getStats'),
    getMyStats: () => notImplemented('profiles.getMyStats'),
    updateMyStats: () => notImplemented('profiles.updateMyStats'),
  },

  auth: {
    async getAccountId() {
      const session = await getSession()
      if (!session) return 'guest'
      const { data, error } = await supabase.from('profiles').select('is_author').eq('id', session.user.id).maybeSingle()
      if (error) throw error
      return data?.is_author ? 'author' : 'reader'
    },
    // Real accounts can't be swapped programmatically the way the local
    // prototype's persona switcher does — signing in/out is the only way to
    // change identity. See src/context/account.tsx and auth-prompt.tsx.
    switchAccount: () => notImplemented('auth.switchAccount'),
  },
}

async function buildProfile(row: ProfileRow): Promise<Profile> {
  const { data: authored, error } = await supabase
    .from('stories')
    .select('slug')
    .eq('author_id', row.id)
    .eq('is_published', true)
  if (error) throw error
  const publishedStoryIds = (authored ?? []).map((s) => s.slug)
  const author = row.is_author || publishedStoryIds.length > 0 ? { penName: row.display_name, publishedStoryIds } : undefined
  return toProfile(row, author)
}
