// Row shapes (hand-written from supabase/migrations/*.sql — no generated
// types exist yet) and the row -> DTO mappers shared across client.ts.

import type {
  AuthorInfo,
  Chapter,
  Comment,
  CommentReply,
  Notification,
  NotificationType,
  Profile,
  ProfileSummary,
  Story,
  StoryStatus,
} from '../types'

// ---- rows -------------------------------------------------------------------

export interface ProfileRow {
  id: string
  username: string
  display_name: string
  avatar_color: string
  bio: string
  favorite_genres: string[]
  is_author: boolean
}

export interface StoryRow {
  id: string
  slug: string
  author_id: string
  title: string
  blurb: string
  synopsis: string
  cover_color: string
  status: string
  is_published: boolean
  updated_at: string
}

export interface ChapterRow {
  id: string
  number: number | null
  title: string
  state: string
  hidden: boolean
  locked: boolean
  word_count: number
}

export interface ParagraphRow {
  ordinal: number
  body: string
}

export interface CommentAuthorRow {
  id: string
  username: string
  display_name: string
  avatar_color: string
}

export interface CommentRow {
  id: string
  author_id: string
  body: string
  created_at: string
  deleted_at: string | null
  author: CommentAuthorRow | CommentAuthorRow[] | null
  replies?: (CommentRow & { replies?: never })[] | null
}

export interface NotificationRow {
  id: string
  type: string
  created_at: string
  read_at: string | null
  actor_id: string | null
  story_id: string | null
  chapter_id: string | null
  actor: CommentAuthorRow | CommentAuthorRow[] | null
  story: { slug: string } | { slug: string }[] | null
  chapter: { number: number | null } | { number: number | null }[] | null
}

// ---- helpers ------------------------------------------------------------

/** PostgREST returns a to-one embed as an object normally, but as a one-item array for some relationship shapes — normalize both. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export function toProfileSummary(row: CommentAuthorRow | null): ProfileSummary | undefined {
  if (!row) return undefined
  return { id: row.id, handle: row.username, displayName: row.display_name, avatarColor: row.avatar_color }
}

export function toProfile(row: ProfileRow, author?: AuthorInfo): Profile {
  return {
    id: row.id,
    handle: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    bio: row.bio,
    favoriteGenres: row.favorite_genres ?? [],
    isAuthor: row.is_author,
    author,
  }
}

export function toStory(
  row: StoryRow,
  opts: { tags: string[]; author?: ProfileSummary; chapters: Chapter[]; stats: Story['stats']; newChapters: number },
): Story {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    authorId: row.author_id,
    author: opts.author,
    tags: opts.tags,
    status: (row.status as StoryStatus) ?? 'ongoing',
    blurb: row.blurb,
    synopsis: row.synopsis,
    coverColor: row.cover_color,
    updatedAt: row.updated_at,
    newChapters: opts.newChapters,
    stats: opts.stats,
    chapters: opts.chapters,
  }
}

export function toChapter(row: ChapterRow, paragraphs: ParagraphRow[]): Chapter {
  return {
    id: row.id,
    number: row.number ?? 0,
    title: row.title,
    wordCount: row.word_count,
    locked: row.locked,
    paragraphs: [...paragraphs].sort((a, b) => a.ordinal - b.ordinal).map((p) => p.body),
  }
}

export function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    authorId: row.author_id,
    author: toProfileSummary(one(row.author)),
    body: row.body,
    createdAt: new Date(row.created_at).getTime(),
    replies: (row.replies ?? [])
      .filter((r) => !r.deleted_at)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(toCommentReply),
  }
}

export function toCommentReply(row: CommentRow): CommentReply {
  return {
    id: row.id,
    authorId: row.author_id,
    author: toProfileSummary(one(row.author)),
    body: row.body,
    createdAt: new Date(row.created_at).getTime(),
  }
}

// The contract's NotificationType is a closed, MVP-scoped enum, but the DB's
// `notifications.type` check constraint (0006_notifications.sql) uses a
// different, not-yet-1:1 vocabulary — some contract types
// ('story-complete', 'story-liked', 'reads-milestone') don't correspond to
// any trigger the DB fires yet (those triggers land in a later phase per the
// migration's own comment). This map is a deliberate, documented deviation:
// best-effort correspondence, not a guarantee every DB type has a distinct
// contract type.
const NOTIFICATION_TYPE_MAP: Record<string, NotificationType> = {
  chapter_published: 'new-chapter',
  comment_reply: 'comment-reply',
  comment_on_story: 'comment-reply',
  story_followed: 'new-follower',
  author_followed: 'new-follower',
}

export function toNotification(row: NotificationRow): Notification {
  const story = one(row.story)
  const chapter = one(row.chapter)
  return {
    id: row.id,
    type: NOTIFICATION_TYPE_MAP[row.type] ?? 'new-chapter',
    at: new Date(row.created_at).getTime(),
    read: row.read_at != null,
    actorId: row.actor_id ?? undefined,
    actor: toProfileSummary(one(row.actor)),
    storySlug: story?.slug,
    chapterNumber: chapter?.number ?? undefined,
  }
}

export { one }
