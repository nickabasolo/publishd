// SupabaseDataClient — Phase 2 (read paths + auth) + Phase 3 (writes).
//
// Phase 2 implemented: stories.feed/getBySlug/byTag/search/allTags,
// chapters.get, comments.list/count/countsForChapter/mine, profiles.getByHandle,
// notifications.list/unreadCount/markRead/markAllRead, and auth.getAccountId.
//
// Phase 3 (this pass) implements: comments.add/reply, likes.*, follows.*,
// reading.*, studio.*, profiles.updateMe. A few methods remain
// `notImplemented` because there is no real backing store for them yet —
// see the comments at each site (profiles.getStats/getMyStats/updateMyStats,
// auth.switchAccount).
//
// IMPORTANT: none of this has been run against a live authenticated session
// (no OAuth session available in this environment) — see the handoff report
// for what's verified vs. unverified.
import type { DataClient } from '../client'
import type {
  ChapterCommentCounts,
  ChapterState,
  ChatFormat,
  ChatParticipants,
  ChatSpeaker,
  Comment,
  InProgressRead,
  Notification,
  Page,
  Profile,
  ProfileSummary,
  Story,
  StoryStatus,
  StudioChapter,
  StudioStory,
} from '../types'
import { getSession } from './auth'
import {
  toChapter,
  toComment,
  toCommentReply,
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
    `[data/supabase] "${method}" is not implemented — see the Phase 3 handoff report for why. ` +
      `Set VITE_DATA_BACKEND=local (the default) until then.`,
  )
}

const COMMENT_AUTHOR_SELECT = 'id, username, display_name, avatar_color'
const COMMENT_SELECT = `id, author_id, body, created_at, deleted_at, author:profiles(${COMMENT_AUTHOR_SELECT}), replies:comments!parent_id(id, author_id, body, created_at, deleted_at, author:profiles(${COMMENT_AUTHOR_SELECT}))`

// ---- shared lookups -------------------------------------------------------

async function currentUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.user.id ?? null
}

async function requireUserId(): Promise<string> {
  const id = await currentUserId()
  if (!id) throw new Error('[data/supabase] sign-in required for this action')
  return id
}

// Anonymous session id for guest read_events (append-only reading analytics
// per the plan; guests can read without an account). Persisted in
// localStorage directly rather than via src/lib/storage.ts's readLocal/
// writeLocal, since those are keyed to the local-adapter's demo-account
// namespacing and this needs to survive across signed-in/guest transitions.
const ANON_SESSION_KEY = 'publishd.anonSessionId'
function anonSessionId(): string {
  try {
    let id = localStorage.getItem(ANON_SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(ANON_SESSION_KEY, id)
    }
    return id
  } catch {
    return 'unknown-session'
  }
}

async function getStoryRowBySlug(slug: string): Promise<StoryRow | null> {
  const { data, error } = await supabase
    .from('stories')
    .select(STORY_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
}

async function getStoryRowByPublicId(publicId: string): Promise<StoryRow | null> {
  // public_id is a bigint column; a non-numeric param can never match, and
  // passing it through as-is would make PostgREST error on the cast.
  if (!/^\d+$/.test(publicId)) return null
  const { data, error } = await supabase
    .from('stories')
    .select(STORY_COLUMNS)
    .eq('public_id', publicId)
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
      .select('chapter_id, ordinal, body, speaker')
      .in('chapter_id', chapterRows.map((c) => c.id))
      .is('deleted_at', null)
    if (pErr) throw pErr
    for (const p of paras ?? []) {
      const list = paragraphs.get(p.chapter_id) ?? []
      list.push({ ordinal: p.ordinal, body: p.body, speaker: p.speaker })
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

const STORY_COLUMNS =
  'id, slug, public_id, author_id, title, blurb, synopsis, cover_color, status, is_published, updated_at, format, chat_participants'

// ---- studio helpers -------------------------------------------------------

interface StudioStoryRow {
  id: string
  slug: string
  public_id: string | number
  title: string
  blurb: string
  synopsis: string
  cover_color: string
  status: string
  format?: string | null
  chat_participants?: ChatParticipants | null
}

const STUDIO_STORY_COLUMNS = 'id, slug, public_id, title, blurb, synopsis, cover_color, status, format, chat_participants'

async function getOwnStudioStoryRow(slug: string, userId: string): Promise<StudioStoryRow | null> {
  const { data, error } = await supabase
    .from('stories')
    .select(STUDIO_STORY_COLUMNS)
    .eq('slug', slug)
    .eq('author_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** First writer of a tag's display casing wins (plan: "Content" / tags). Insert-and-ignore-conflict, then look up by slug. */
async function ensureTagId(displayName: string): Promise<string> {
  const trimmed = displayName.trim()
  const slug = trimmed.toLowerCase()
  const { error: insertErr } = await supabase.from('tags').insert({ slug, display_name: trimmed })
  if (insertErr && insertErr.code !== '23505') throw insertErr // 23505 = unique_violation: tag already exists, expected
  const { data, error } = await supabase.from('tags').select('id').eq('slug', slug).single()
  if (error) throw error
  return data.id
}

async function fetchStudioStoryTags(storyId: string): Promise<string[]> {
  const { data, error } = await supabase.from('story_tags').select('tag:tags(display_name)').eq('story_id', storyId)
  if (error) throw error
  return ((data ?? []) as { tag: { display_name: string } | { display_name: string }[] | null }[])
    .map((r) => (Array.isArray(r.tag) ? r.tag[0]?.display_name : r.tag?.display_name))
    .filter((s): s is string => Boolean(s))
}

async function fetchStudioChapters(storyId: string, format: ChatFormat): Promise<StudioChapter[]> {
  const { data: rows, error } = await supabase
    .from('chapters')
    .select('id, number, title, state, hidden, locked, word_count, scheduled_at, created_at')
    .eq('story_id', storyId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const chapterRows = rows ?? []
  if (chapterRows.length === 0) return []

  const { data: paras, error: pErr } = await supabase
    .from('paragraphs')
    .select('chapter_id, ordinal, body, speaker')
    .in(
      'chapter_id',
      chapterRows.map((c) => c.id),
    )
    .is('deleted_at', null)
  if (pErr) throw pErr
  const byChapter = new Map<string, ParagraphRow[]>()
  for (const p of paras ?? []) {
    const list = byChapter.get(p.chapter_id) ?? []
    list.push({ ordinal: p.ordinal, body: p.body, speaker: p.speaker })
    byChapter.set(p.chapter_id, list)
  }

  return chapterRows.map((c, i) => {
    const sorted = (byChapter.get(c.id) ?? []).sort((a, b) => a.ordinal - b.ordinal)
    return {
      id: c.id,
      // Unpublished chapters have no assigned `number` (see 0003_content.sql —
      // it's only ever set at publish). Falling back to creation order here is
      // purely cosmetic display numbering for the Studio chapter list, never
      // written back to the DB and never confused with the real, permanent
      // `number` a chapter gets on publish.
      number: c.number ?? i + 1,
      title: c.title,
      body: sorted.map((p) => p.body).join('\n\n'),
      state: c.state as ChapterState,
      scheduledAt: c.scheduled_at ? new Date(c.scheduled_at).getTime() : undefined,
      locked: c.locked,
      wordCount: c.word_count,
      messages: format === 'chat' ? sorted.map((p) => ({ speaker: (p.speaker as ChatSpeaker) ?? 'a', text: p.body })) : undefined,
    }
  })
}

async function buildStudioStory(row: StudioStoryRow): Promise<StudioStory> {
  const format = (row.format as ChatFormat | undefined) ?? 'prose'
  const [tags, chapters] = await Promise.all([fetchStudioStoryTags(row.id), fetchStudioChapters(row.id, format)])
  return {
    slug: row.slug,
    publicId: String(row.public_id),
    title: row.title,
    blurb: row.blurb,
    synopsis: row.synopsis,
    tags,
    coverColor: row.cover_color,
    status: row.status as StoryStatus,
    chapters,
    format,
    chatParticipants: row.chat_participants ?? undefined,
  }
}

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

    async getById(publicId) {
      const row = await getStoryRowByPublicId(publicId)
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

    // Real aggregate query via `get_story_analytics` (0015_story_analytics.sql),
    // never hash-fabricated. The RPC is security-definer and checks
    // ownership internally (auth.uid() must be the story's author_id) since
    // read_events/reading_progress are RLS-private to their own profile_id
    // and can't otherwise be aggregated "across all readers of my story"
    // under RLS. It returns zero rows for a story that doesn't exist or
    // isn't owned by the caller, which this maps to `null`.
    async getAnalytics(slug) {
      const { data, error } = await supabase.rpc('get_story_analytics', { p_story_slug: slug })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return null
      const r = row as {
        total_reads: number
        likes: number
        comments: number
        subscribers: number
        completion_rate: number
        reads_by_chapter: { label: string; value: number }[]
        reads_last_30: number[]
        top_passages: { chapter: number; paragraph: number; likes: number }[]
      }
      return {
        totalReads: r.total_reads ?? 0,
        likes: r.likes ?? 0,
        comments: r.comments ?? 0,
        subscribers: r.subscribers ?? 0,
        completionRate: r.completion_rate ?? 0,
        readsByChapter: r.reads_by_chapter ?? [],
        readsLast30: r.reads_last_30 ?? [],
        topPassages: r.top_passages ?? [],
      }
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
        .select('ordinal, body, speaker')
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

    async add(anchor, body) {
      const userId = await requireUserId()
      const resolved = await resolveAnchor(anchor)
      if (!resolved) throw new Error(`[data/supabase] comment anchor "${anchor}" does not resolve to a visible chapter`)
      const text = body.trim()

      // body_snapshot: the plan describes this as "captured at insert time",
      // but no migration actually populates it server-side (checked 0004,
      // 0010, 0011 — the column exists, no trigger writes it). Captured
      // client-side here instead: not security-sensitive (worst case is a
      // stale/wrong snapshot string, not an authz bypass), and resolveAnchor
      // already has the paragraph id in hand. Flagged in the handoff report
      // as a real gap — this belongs in a before-insert trigger.
      let snapshot: string | null = null
      if (resolved.paragraphId) {
        const { data: para, error: paraErr } = await supabase
          .from('paragraphs')
          .select('body')
          .eq('id', resolved.paragraphId)
          .maybeSingle()
        if (paraErr) throw paraErr
        snapshot = para?.body ? para.body.slice(0, 200) : null
      }

      const { data, error } = await supabase
        .from('comments')
        .insert({
          author_id: userId,
          chapter_id: resolved.chapterId,
          paragraph_id: resolved.paragraphId,
          body: text,
          body_snapshot: snapshot,
        })
        .select(COMMENT_SELECT)
        .single()
      if (error) throw error
      return toComment(data as CommentRow)
    },

    async reply(commentId, body) {
      const userId = await requireUserId()
      const { data: parent, error: parentErr } = await supabase
        .from('comments')
        .select('chapter_id, paragraph_id, body_snapshot')
        .eq('id', commentId)
        .single()
      if (parentErr) throw parentErr

      const text = body.trim()
      const { data, error } = await supabase
        .from('comments')
        .insert({
          author_id: userId,
          chapter_id: parent.chapter_id,
          paragraph_id: parent.paragraph_id,
          parent_id: commentId,
          body: text,
          // Replies anchor to the same paragraph as their parent, so they
          // share its snapshot rather than needing one of their own — a
          // reply has no independent anchor to snapshot from.
          body_snapshot: parent.body_snapshot,
        })
        // The `enforce_one_level_comment_nesting` trigger (0004_social.sql)
        // rejects this insert with a DB error if `commentId` itself already
        // has a parent_id — surfaced to the caller as-is, not re-checked here.
        .select(`id, author_id, body, created_at, deleted_at, author:profiles(${COMMENT_AUTHOR_SELECT})`)
        .single()
      if (error) throw error
      return toCommentReply(data as CommentRow)
    },
  },

  likes: {
    story: {
      async has(slug) {
        const userId = await currentUserId()
        if (!userId) return false
        const story = await getStoryRowBySlug(slug)
        if (!story) return false
        const { data, error } = await supabase
          .from('story_likes')
          .select('profile_id')
          .eq('profile_id', userId)
          .eq('target_id', story.id)
          .maybeSingle()
        if (error) throw error
        return data != null
      },
      async toggle(slug) {
        const userId = await requireUserId()
        const story = await getStoryRowBySlug(slug)
        if (!story) throw new Error(`[data/supabase] story "${slug}" not found`)
        const { data: existing, error: exErr } = await supabase
          .from('story_likes')
          .select('profile_id')
          .eq('profile_id', userId)
          .eq('target_id', story.id)
          .maybeSingle()
        if (exErr) throw exErr
        if (existing) {
          const { error } = await supabase
            .from('story_likes')
            .delete()
            .eq('profile_id', userId)
            .eq('target_id', story.id)
          if (error) throw error
          return false
        }
        const { error } = await supabase.from('story_likes').insert({ profile_id: userId, target_id: story.id })
        if (error) throw error
        return true
      },
      async mine() {
        const userId = await currentUserId()
        if (!userId) return []
        const { data, error } = await supabase
          .from('story_likes')
          .select('story:stories(slug)')
          .eq('profile_id', userId)
        if (error) throw error
        return ((data ?? []) as { story: { slug: string } | { slug: string }[] | null }[])
          .map((r) => (Array.isArray(r.story) ? r.story[0]?.slug : r.story?.slug))
          .filter((s): s is string => Boolean(s))
      },
    },
    paragraph: {
      async has(anchor) {
        const userId = await currentUserId()
        if (!userId) return false
        const resolved = await resolveAnchor(anchor)
        if (!resolved?.paragraphId) return false
        const { data, error } = await supabase
          .from('paragraph_likes')
          .select('profile_id')
          .eq('profile_id', userId)
          .eq('target_id', resolved.paragraphId)
          .maybeSingle()
        if (error) throw error
        return data != null
      },
      async baseCount(anchor) {
        const resolved = await resolveAnchor(anchor)
        if (!resolved?.paragraphId) return 0
        const userId = await currentUserId()
        const [{ count, error }, mine] = await Promise.all([
          supabase
            .from('paragraph_likes')
            .select('*', { count: 'exact', head: true })
            .eq('target_id', resolved.paragraphId),
          userId
            ? supabase
                .from('paragraph_likes')
                .select('profile_id')
                .eq('profile_id', userId)
                .eq('target_id', resolved.paragraphId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        if (error) throw error
        // Matches the local adapter's seed-baseline semantics: total minus
        // the caller's own like, since callers add their own toggle on top.
        return Math.max(0, (count ?? 0) - (mine.data ? 1 : 0))
      },
      async toggle(anchor) {
        const userId = await requireUserId()
        const resolved = await resolveAnchor(anchor)
        if (!resolved?.paragraphId) throw new Error(`[data/supabase] paragraph anchor "${anchor}" not found`)
        const { data: existing, error: exErr } = await supabase
          .from('paragraph_likes')
          .select('profile_id')
          .eq('profile_id', userId)
          .eq('target_id', resolved.paragraphId)
          .maybeSingle()
        if (exErr) throw exErr
        if (existing) {
          const { error } = await supabase
            .from('paragraph_likes')
            .delete()
            .eq('profile_id', userId)
            .eq('target_id', resolved.paragraphId)
          if (error) throw error
          return false
        }
        const { error } = await supabase
          .from('paragraph_likes')
          .insert({ profile_id: userId, target_id: resolved.paragraphId })
        if (error) throw error
        return true
      },
      async forChapter(slug, chapterNumber) {
        const story = await getStoryRowBySlug(slug)
        if (!story) return {}
        const { data: chapter, error: chErr } = await supabase
          .from('chapters')
          .select('id')
          .eq('story_id', story.id)
          .eq('number', chapterNumber)
          .eq('state', 'published')
          .eq('hidden', false)
          .maybeSingle()
        if (chErr) throw chErr
        if (!chapter) return {}

        const { data: paras, error: pErr } = await supabase
          .from('paragraphs')
          .select('id, ordinal')
          .eq('chapter_id', chapter.id)
          .is('deleted_at', null)
        if (pErr) throw pErr
        const paragraphRows = paras ?? []
        if (paragraphRows.length === 0) return {}
        const paragraphIds = paragraphRows.map((p) => p.id)

        const userId = await currentUserId()
        const { data: likeRows, error: lErr } = await supabase
          .from('paragraph_likes')
          .select('profile_id, target_id')
          .in('target_id', paragraphIds)
        if (lErr) throw lErr

        const totals = new Map<string, number>()
        const likedByMe = new Set<string>()
        for (const row of likeRows ?? []) {
          totals.set(row.target_id, (totals.get(row.target_id) ?? 0) + 1)
          if (userId && row.profile_id === userId) likedByMe.add(row.target_id)
        }

        const result: Record<number, { liked: boolean; total: number }> = {}
        for (const p of paragraphRows) {
          result[p.ordinal] = { liked: likedByMe.has(p.id), total: totals.get(p.id) ?? 0 }
        }
        return result
      },
      async mine() {
        const userId = await currentUserId()
        if (!userId) return []
        const { data, error } = await supabase
          .from('paragraph_likes')
          .select('paragraph:paragraphs(ordinal, chapter:chapters(number, story:stories(slug)))')
          .eq('profile_id', userId)
        if (error) throw error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ((data ?? []) as any[])
          .map((r) => {
            const paragraph = Array.isArray(r.paragraph) ? r.paragraph[0] : r.paragraph
            const chapter = paragraph ? (Array.isArray(paragraph.chapter) ? paragraph.chapter[0] : paragraph.chapter) : null
            const story = chapter ? (Array.isArray(chapter.story) ? chapter.story[0] : chapter.story) : null
            if (!paragraph || !chapter || !story) return null
            return `${story.slug}/${chapter.number}/${paragraph.ordinal}`
          })
          .filter((a): a is string => Boolean(a))
      },
    },
  },

  follows: {
    story: {
      async isFollowing(slug) {
        const userId = await currentUserId()
        if (!userId) return false
        const story = await getStoryRowBySlug(slug)
        if (!story) return false
        const { data, error } = await supabase
          .from('story_follows')
          .select('profile_id')
          .eq('profile_id', userId)
          .eq('target_id', story.id)
          .maybeSingle()
        if (error) throw error
        return data != null
      },
      async toggle(slug) {
        const userId = await requireUserId()
        const story = await getStoryRowBySlug(slug)
        if (!story) throw new Error(`[data/supabase] story "${slug}" not found`)
        const { data: existing, error: exErr } = await supabase
          .from('story_follows')
          .select('profile_id')
          .eq('profile_id', userId)
          .eq('target_id', story.id)
          .maybeSingle()
        if (exErr) throw exErr
        if (existing) {
          const { error } = await supabase
            .from('story_follows')
            .delete()
            .eq('profile_id', userId)
            .eq('target_id', story.id)
          if (error) throw error
          return false
        }
        const { error } = await supabase.from('story_follows').insert({ profile_id: userId, target_id: story.id })
        if (error) throw error
        return true
      },
    },
    author: {
      async isFollowing(handle) {
        const userId = await currentUserId()
        if (!userId) return false
        const { data: profile, error: pErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', handle)
          .maybeSingle()
        if (pErr) throw pErr
        if (!profile) return false
        const { data, error } = await supabase
          .from('author_follows')
          .select('follower_id')
          .eq('follower_id', userId)
          .eq('author_id', profile.id)
          .maybeSingle()
        if (error) throw error
        return data != null
      },
      async toggle(handle) {
        const userId = await requireUserId()
        const { data: profile, error: pErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', handle)
          .maybeSingle()
        if (pErr) throw pErr
        if (!profile) throw new Error(`[data/supabase] author "${handle}" not found`)
        const { data: existing, error: exErr } = await supabase
          .from('author_follows')
          .select('follower_id')
          .eq('follower_id', userId)
          .eq('author_id', profile.id)
          .maybeSingle()
        if (exErr) throw exErr
        if (existing) {
          const { error } = await supabase
            .from('author_follows')
            .delete()
            .eq('follower_id', userId)
            .eq('author_id', profile.id)
          if (error) throw error
          return false
        }
        // `check (follower_id <> author_id)` on the table rejects self-follow;
        // let that DB error surface rather than re-checking it here.
        const { error } = await supabase
          .from('author_follows')
          .insert({ follower_id: userId, author_id: profile.id })
        if (error) throw error
        return true
      },
      async mine() {
        const userId = await currentUserId()
        if (!userId) return []
        const { data, error } = await supabase
          .from('author_follows')
          .select('author:profiles(username)')
          .eq('follower_id', userId)
        if (error) throw error
        return ((data ?? []) as { author: { username: string } | { username: string }[] | null }[])
          .map((r) => (Array.isArray(r.author) ? r.author[0]?.username : r.author?.username))
          .filter((s): s is string => Boolean(s))
      },
    },
  },

  reading: {
    async getProgress(storyId) {
      const userId = await currentUserId()
      if (!userId) return null
      const story = await getStoryRowBySlug(storyId)
      if (!story) return null
      const { data, error } = await supabase
        .from('reading_progress')
        .select('chapter_number, completed, updated_at')
        .eq('profile_id', userId)
        .eq('story_id', story.id)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        storyId,
        chapterNumber: data.chapter_number ?? 0,
        completed: data.completed,
        updatedAt: new Date(data.updated_at).getTime(),
      }
    },

    async inProgress(params) {
      const userId = await currentUserId()
      if (!userId) return emptyPage<InProgressRead>()
      const { rows, nextCursor } = await fetchPage<{
        chapter_number: number | null
        completed: boolean
        updated_at: string
        story: StoryRow | StoryRow[] | null
      }>(
        supabase
          .from('reading_progress')
          .select(`chapter_number, completed, updated_at, story:stories(${STORY_COLUMNS})`)
          .eq('profile_id', userId)
          .eq('completed', false)
          .order('updated_at', { ascending: false }),
        params,
      )
      const items = await Promise.all(
        rows.map(async (row): Promise<InProgressRead | null> => {
          const storyRow = Array.isArray(row.story) ? row.story[0] : row.story
          if (!storyRow) return null
          const { rows: chapterRows, paragraphs } = await fetchPublishedChapters(storyRow.id)
          const story = await buildStory(storyRow, chapterRows, paragraphs)
          return {
            storyId: storyRow.slug,
            chapterNumber: row.chapter_number ?? 0,
            completed: row.completed,
            updatedAt: new Date(row.updated_at).getTime(),
            story,
          }
        }),
      )
      return { items: items.filter((i): i is InProgressRead => i != null), nextCursor }
    },

    async startChapter(storyId, chapterNumber) {
      const userId = await requireUserId()
      const story = await getStoryRowBySlug(storyId)
      if (!story) throw new Error(`[data/supabase] story "${storyId}" not found`)
      const { data: chapter, error: chErr } = await supabase
        .from('chapters')
        .select('id')
        .eq('story_id', story.id)
        .eq('number', chapterNumber)
        .eq('state', 'published')
        .eq('hidden', false)
        .maybeSingle()
      if (chErr) throw chErr
      if (!chapter) throw new Error(`[data/supabase] chapter ${chapterNumber} of "${storyId}" not found`)

      const now = new Date().toISOString()
      const { error } = await supabase.from('reading_progress').upsert(
        {
          profile_id: userId,
          story_id: story.id,
          chapter_id: chapter.id,
          chapter_number: chapterNumber,
          completed: false,
          updated_at: now,
        },
        { onConflict: 'profile_id,story_id' },
      )
      if (error) throw error

      // Append-only per the plan ("insert on chapter open"). There is no
      // client update path for `completed` on this row (see completeChapter)
      // — see the handoff report.
      const { error: eventErr } = await supabase.from('read_events').insert({
        profile_id: userId,
        session_id: anonSessionId(),
        story_id: story.id,
        chapter_id: chapter.id,
        completed: false,
      })
      if (eventErr) throw eventErr

      return { storyId, chapterNumber, completed: false, updatedAt: Date.now() }
    },

    async completeChapter(storyId, chapterNumber) {
      const userId = await requireUserId()
      const story = await getStoryRowBySlug(storyId)
      if (!story) throw new Error(`[data/supabase] story "${storyId}" not found`)
      const { data: chapter, error: chErr } = await supabase
        .from('chapters')
        .select('id')
        .eq('story_id', story.id)
        .eq('number', chapterNumber)
        .eq('state', 'published')
        .eq('hidden', false)
        .maybeSingle()
      if (chErr) throw chErr
      if (!chapter) throw new Error(`[data/supabase] chapter ${chapterNumber} of "${storyId}" not found`)

      const now = new Date().toISOString()
      const { error } = await supabase.from('reading_progress').upsert(
        {
          profile_id: userId,
          story_id: story.id,
          chapter_id: chapter.id,
          chapter_number: chapterNumber,
          completed: true,
          updated_at: now,
        },
        { onConflict: 'profile_id,story_id' },
      )
      if (error) throw error

      // Flip the matching read_events row's `completed` too, via the
      // security-definer RPC added in 0014_reading_stats.sql (read_events
      // has no client update policy by design — this is exactly the RPC the
      // Phase 3/4 handoff flagged as missing). Best-effort: reading_progress
      // above is what the app actually reads, so a failure here shouldn't
      // fail the whole completeChapter call.
      const { error: completeEventErr } = await supabase.rpc('complete_read_event', {
        p_chapter_id: chapter.id,
      })
      if (completeEventErr) console.error('[data/supabase] complete_read_event failed', completeEventErr)

      return { storyId, chapterNumber, completed: true, updatedAt: Date.now() }
    },

    async dismiss(storyId) {
      const userId = await currentUserId()
      if (!userId) return
      const story = await getStoryRowBySlug(storyId)
      if (!story) return
      const { error } = await supabase
        .from('reading_progress')
        .update({ completed: true, updated_at: new Date().toISOString() })
        .eq('profile_id', userId)
        .eq('story_id', story.id)
        .eq('completed', false)
      if (error) throw error
    },
  },

  notifications: {
    async list(params) {
      const userId = await currentUserId()
      if (!userId) return emptyPage<Notification>()
      const { rows, nextCursor } = await fetchPage<NotificationRow>(
        supabase
          .from('notifications')
          .select(
            'id, type, created_at, read_at, actor_id, story_id, chapter_id, actor:profiles(id, username, display_name, avatar_color), story:stories(slug, public_id), chapter:chapters(number)',
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

  studio: {
    async listMine() {
      const userId = await requireUserId()
      const { data, error } = await supabase
        .from('stories')
        .select('id, slug, public_id, title, blurb, synopsis, cover_color, status')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return Promise.all((data ?? []).map(buildStudioStory))
    },

    async getBySlug(slug) {
      const userId = await currentUserId()
      if (!userId) return null
      const { data, error } = await supabase
        .from('stories')
        .select('id, slug, public_id, title, blurb, synopsis, cover_color, status')
        .eq('slug', slug)
        .eq('author_id', userId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return buildStudioStory(data)
    },

    async createStory() {
      const userId = await requireUserId()
      const slug = `draft-${crypto.randomUUID().slice(0, 8)}`
      const { error } = await supabase.from('stories').insert({
        slug,
        author_id: userId,
        title: 'Untitled story',
        blurb: '',
        synopsis: '',
        cover_color: '#6366f1',
        status: 'ongoing',
        is_published: false,
      })
      if (error) throw error
      return slug
    },

    async createStoryWithFirstChapter(format) {
      const userId = await requireUserId()
      const slug = `draft-${crypto.randomUUID().slice(0, 8)}`
      const { data: story, error: storyErr } = await supabase
        .from('stories')
        .insert({
          slug,
          author_id: userId,
          title: 'Untitled story',
          blurb: '',
          synopsis: '',
          cover_color: '#6366f1',
          status: 'ongoing',
          is_published: false,
          format,
        })
        .select('id')
        .single()
      if (storyErr) throw storyErr
      const { data: chapter, error: chapterErr } = await supabase
        .from('chapters')
        .insert({ story_id: story.id, title: 'Untitled chapter', state: 'draft', locked: false })
        .select('id')
        .single()
      if (chapterErr) throw chapterErr
      return { slug, chapterId: chapter.id }
    },

    async updateStory(slug, patch) {
      const userId = await requireUserId()
      const story = await getOwnStudioStoryRow(slug, userId)
      if (!story) throw new Error(`[data/supabase] studio story "${slug}" not found`)

      const fields: Record<string, unknown> = {}
      if (patch.title !== undefined) fields.title = patch.title
      if (patch.blurb !== undefined) fields.blurb = patch.blurb
      if (patch.synopsis !== undefined) fields.synopsis = patch.synopsis
      if (patch.coverColor !== undefined) fields.cover_color = patch.coverColor
      if (patch.status !== undefined) fields.status = patch.status
      if (patch.format !== undefined) fields.format = patch.format
      if (patch.chatParticipants !== undefined) fields.chat_participants = patch.chatParticipants
      if (Object.keys(fields).length > 0) {
        const { error } = await supabase.from('stories').update(fields).eq('id', story.id)
        if (error) throw error
      }

      if (patch.tags !== undefined) {
        const tagIds = await Promise.all(patch.tags.map(ensureTagId))
        const { data: existingLinks, error: linksErr } = await supabase
          .from('story_tags')
          .select('tag_id')
          .eq('story_id', story.id)
        if (linksErr) throw linksErr
        const existingIds = new Set((existingLinks ?? []).map((l) => l.tag_id))
        const nextIds = new Set(tagIds)
        const toRemove = [...existingIds].filter((id) => !nextIds.has(id))
        const toAdd = [...nextIds].filter((id) => !existingIds.has(id))
        if (toRemove.length > 0) {
          const { error } = await supabase.from('story_tags').delete().eq('story_id', story.id).in('tag_id', toRemove)
          if (error) throw error
        }
        if (toAdd.length > 0) {
          const { error } = await supabase
            .from('story_tags')
            .insert(toAdd.map((tag_id) => ({ story_id: story.id, tag_id })))
          if (error) throw error
        }
      }
    },

    async addChapter(slug) {
      const userId = await requireUserId()
      const story = await getOwnStudioStoryRow(slug, userId)
      if (!story) throw new Error(`[data/supabase] studio story "${slug}" not found`)
      const { data, error } = await supabase
        .from('chapters')
        .insert({ story_id: story.id, title: 'Untitled chapter', state: 'draft', locked: false })
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },

    async updateChapter(_slug, chapterId, patch) {
      if (patch.messages !== undefined) {
        // Chat-format sibling of the save_chapter_draft RPC below — same
        // ordinal-reshuffle diff, plus a speaker column. See
        // 0018_chat_format.sql.
        const { error } = await supabase.rpc('save_chat_chapter_draft', {
          p_chapter_id: chapterId,
          p_title: patch.title ?? null,
          p_messages: patch.messages,
          p_locked: patch.locked ?? null,
        })
        if (error) throw error
        return
      }
      if (patch.body !== undefined) {
        // Routes through the paragraph-diff RPC (0010/0011) rather than a
        // direct table write — this is what keeps comment anchors stable
        // across edits. Title/locked are passed through too (the RPC
        // COALESCEs nulls to "leave unchanged") so a combined patch is one
        // round trip, not two.
        const { error } = await supabase.rpc('save_chapter_draft', {
          p_chapter_id: chapterId,
          p_title: patch.title ?? null,
          p_plain_text: patch.body,
          p_locked: patch.locked ?? null,
        })
        if (error) throw error
        return
      }
      const fields: Record<string, unknown> = {}
      if (patch.title !== undefined) fields.title = patch.title
      if (patch.locked !== undefined) fields.locked = patch.locked
      if (Object.keys(fields).length === 0) return
      const { error } = await supabase.from('chapters').update(fields).eq('id', chapterId)
      if (error) throw error
    },

    async setChapterState(_slug, chapterId, state) {
      if (state === 'published') {
        // _do_publish (0012_fix_is_published.sql) now flips
        // `stories.is_published` atomically as part of the same transaction
        // that publishes the chapter, so this is a single RPC call — no
        // client-side follow-up write, and no window where the RPC succeeds
        // but the story is left invisible by RLS.
        const { error } = await supabase.rpc('publish_chapter', { p_chapter_id: chapterId })
        if (error) throw error
        return
      }
      if (state === 'draft') {
        const { error } = await supabase.rpc('unpublish_chapter', { p_chapter_id: chapterId })
        if (error) throw error
        return
      }
      // The UI never calls this with 'scheduled' directly (see
      // chapter-editor.tsx / story-manager.tsx) — scheduleChapter is the
      // dedicated entry point, since scheduling needs a target time this
      // method doesn't receive.
      throw new Error('[data/supabase] use studio.scheduleChapter to schedule a chapter')
    },

    async scheduleChapter(_slug, chapterId, at) {
      const { error } = await supabase.rpc('schedule_chapter', {
        p_chapter_id: chapterId,
        p_at: new Date(at).toISOString(),
      })
      if (error) throw error
    },

    async setPaywall(_slug, chapterId, locked) {
      const { error } = await supabase.from('chapters').update({ locked }).eq('id', chapterId)
      if (error) throw error
    },

    async deleteChapter(_slug, chapterId) {
      const { data: chapterRow, error: chErr } = await supabase
        .from('chapters')
        .select('state')
        .eq('id', chapterId)
        .single()
      if (chErr) throw chErr
      if (chapterRow.state === 'published') {
        // Plan: "Delete — hard delete only for chapters that were never
        // published. Published chapters are hidden, not deleted." The
        // DataClient interface has no separate hide/unhide method (studio's
        // `ChapterState` union is draft|scheduled|published, no 'hidden'),
        // so retracting via set_chapter_hidden is the closest safe behavior
        // available through this call — it preserves the row instead of
        // violating that invariant. The Studio UI has no way to show/undo a
        // hidden-but-still-"published"-state chapter yet; flagged in the
        // handoff report as a real contract gap, not something to paper over
        // by changing the shared StudioChapter type unilaterally.
        const { error } = await supabase.rpc('set_chapter_hidden', { p_chapter_id: chapterId, p_hidden: true })
        if (error) throw error
        return
      }
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId)
      if (error) throw error
    },
  },

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

    async updateMe(patch) {
      const userId = await requireUserId()
      const fields: Record<string, unknown> = {}
      if (patch.displayName !== undefined) fields.display_name = patch.displayName
      if (patch.handle !== undefined) fields.username = patch.handle
      if (patch.avatarColor !== undefined) fields.avatar_color = patch.avatarColor
      if (patch.bio !== undefined) fields.bio = patch.bio
      if (patch.favoriteGenres !== undefined) fields.favorite_genres = patch.favoriteGenres
      // `isAuthor`/`author` are derived (is_author is flipped by the DB, not
      // client-writable per RLS's implicit column set; author is computed
      // from published stories), so they're intentionally not mapped here
      // even though Partial<Profile> technically allows them in a patch.
      const { data, error } = await supabase
        .from('profiles')
        .update(fields)
        .eq('id', userId)
        .select('id, username, display_name, avatar_color, bio, favorite_genres, is_author')
        .single()
      if (error) throw error
      return buildProfile(data as ProfileRow)
    },

    // ReadingStats, backed by real data (0014_reading_stats.sql):
    // booksRead/chaptersRead from reading_progress/read_events, minutesRead
    // honestly reported as 0 (no dwell-time column exists anywhere in the
    // schema — that's instrumentation scope, Phase 6, not fabricable here),
    // dayStreak computed from consecutive read_events days. Both RPCs return
    // aggregates only, never raw rows, since read_events/reading_progress
    // are RLS-private to their owner.
    async getStats(handle) {
      const { data, error } = await supabase.rpc('get_reading_stats', { p_handle: handle })
      if (error) throw error
      const row = (Array.isArray(data) ? data[0] : data) as
        | { books_read: number; chapters_read: number; minutes_read: number; day_streak: number }
        | undefined
      return {
        booksRead: row?.books_read ?? 0,
        chaptersRead: row?.chapters_read ?? 0,
        minutesRead: row?.minutes_read ?? 0,
        dayStreak: row?.day_streak ?? 0,
      }
    },

    async getMyStats() {
      const { data, error } = await supabase.rpc('get_my_reading_stats')
      if (error) throw error
      const row = (Array.isArray(data) ? data[0] : data) as
        | { books_read: number; chapters_read: number; minutes_read: number; day_streak: number }
        | undefined
      return {
        booksRead: row?.books_read ?? 0,
        chaptersRead: row?.chapters_read ?? 0,
        minutesRead: row?.minutes_read ?? 0,
        dayStreak: row?.day_streak ?? 0,
      }
    },

    // Stats are computed from read_events/reading_progress, not a value the
    // client owns — there is no real-backend equivalent of the local
    // adapter's fake per-account stat blob. The only caller is
    // settings.tsx's "Adjust demo values" panel, which is explicitly local
    // demo debug UI (see its own comments); against a real backend that
    // panel has nothing meaningful to write, so this stays unimplemented by
    // design rather than accepting writes that would just be silently
    // discarded or, worse, corrupt the derived numbers.
    updateMyStats: () =>
      notImplemented(
        'profiles.updateMyStats — reading stats are derived from read_events/reading_progress and are not client-writable against the real backend',
      ),
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
