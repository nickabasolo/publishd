#!/usr/bin/env node
// scripts/seed.mjs
//
// Imports the prototype's static demo data into real Supabase rows:
//   - src/data/accounts.ts      -> profiles (+ matching auth.users) for the
//                                  "reader" and "author" demo personas
//   - src/data/stories.json     -> profiles for story authors, stories, tags,
//                                  story_tags, chapters, paragraphs
//   - src/data/comments-seed.ts -> profiles for recurring commenters,
//                                  comments (anchored to real paragraph ids),
//                                  and baseline paragraph_likes
//
// Usage:
//   node --env-file=.env.local scripts/seed.mjs
//
// Requires SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in the
// environment (see .env.example). The service role key bypasses RLS — it is
// never used by the app itself, never logged here, and must never be
// committed.
//
// Idempotent: every row this script owns gets an id deterministically
// derived from a stable natural key in the source data (slug, handle,
// chapter id, paragraph index, comment id — see deterministicUuid below), and
// every write is an upsert keyed on that id. Re-running the script updates
// existing rows in place instead of duplicating them.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { register } from 'node:module'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error(
    [
      '',
      '[seed] SUPABASE_SERVICE_ROLE_KEY is not set.',
      '  This script needs the service role key to create auth users and bypass RLS.',
      '  Get it from Settings -> API in the Supabase dashboard, put it in .env.local',
      '  (never commit it, never paste it into chat), and run again with:',
      '    node --env-file=.env.local scripts/seed.mjs',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

if (!SUPABASE_URL) {
  console.error(
    '\n[seed] VITE_SUPABASE_URL is not set. Add it to .env.local (see .env.example).\n',
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function fail(message) {
  console.error(`[seed] FAILED: ${message}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Deterministic ids
// ---------------------------------------------------------------------------

function deterministicUuid(seed) {
  const hash = createHash('sha256').update(`publishd-seed:${seed}`).digest()
  const bytes = Buffer.from(hash.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50 // mark as a "version 5-ish" uuid for readability
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant bits
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function slugifyTag(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ---------------------------------------------------------------------------
// Load source data.
//
// stories.json is plain JSON. accounts.ts / comments-seed.ts are TypeScript
// modules; Node 24 strips their type syntax natively, but accounts.ts also
// pulls in a *value* import through the app's "@/..." alias, which plain
// Node can't resolve on its own — register a tiny hook that teaches it just
// that one alias before importing anything under src/.
// ---------------------------------------------------------------------------

register('./ts-alias-loader.mjs', import.meta.url)

const stories = JSON.parse(readFileSync(path.join(REPO_ROOT, 'src/data/stories.json'), 'utf8'))
const { ACCOUNTS } = await import('../src/data/accounts.ts')
const { COMMENT_SEED, PARAGRAPH_LIKE_SEED } = await import('../src/data/comments-seed.ts')

console.log(`[seed] loaded ${stories.length} stories from stories.json`)

// ---------------------------------------------------------------------------
// Profiles (+ matching auth.users)
// ---------------------------------------------------------------------------

const profileIdByHandle = new Map()

async function ensureProfile(handle, { name, avatarColor, bio = '', favoriteGenres = [], isAuthor = false }) {
  if (profileIdByHandle.has(handle)) return profileIdByHandle.get(handle)

  const id = deterministicUuid(`profile:${handle}`)

  const { data: got, error: getErr } = await supabase.auth.admin.getUserById(id)
  let userExists = Boolean(got?.user)
  if (getErr && getErr.status !== 404) {
    fail(`checking auth user for @${handle}: ${getErr.message}`)
  }

  if (!userExists) {
    const { error: createErr } = await supabase.auth.admin.createUser({
      id,
      email: `${handle}@seed.publishd.invalid`,
      email_confirm: true,
      user_metadata: { full_name: name, seeded: true },
    })
    if (createErr) fail(`creating auth user for @${handle}: ${createErr.message}`)
  }

  // Overwrite whatever handle_new_user guessed for username/display_name
  // with the exact demo identity — the trigger's slugify heuristic has no
  // way to know we want "mothlight" for a persona named "Moth".
  const { error: profileErr } = await supabase.from('profiles').upsert(
    {
      id,
      username: handle,
      display_name: name,
      avatar_color: avatarColor,
      bio,
      favorite_genres: favoriteGenres,
      is_author: isAuthor,
    },
    { onConflict: 'id' },
  )
  if (profileErr) fail(`upserting profile @${handle}: ${profileErr.message}`)

  profileIdByHandle.set(handle, id)
  return id
}

// Gather every person referenced anywhere in the seed data, keyed by handle
// so the same person (e.g. Mara Vance, both a story author and the "author"
// demo persona) is only created once.
const people = new Map()
function mergePerson(handle, patch) {
  people.set(handle, { ...(people.get(handle) ?? { handle, name: handle, avatarColor: '#6366f1' }), ...patch })
}

for (const story of stories) {
  mergePerson(story.author.handle, {
    name: story.author.name,
    avatarColor: story.author.avatarColor,
    isAuthor: true,
  })
}

for (const anchorComments of Object.values(COMMENT_SEED)) {
  for (const comment of anchorComments) {
    mergePerson(comment.author.handle, { name: comment.author.name, avatarColor: comment.author.avatarColor })
    for (const reply of comment.replies ?? []) {
      mergePerson(reply.author.handle, { name: reply.author.name, avatarColor: reply.author.avatarColor })
    }
  }
}

// The "guest" persona is signed out by definition and gets no profile row.
mergePerson(ACCOUNTS.reader.user.username, {
  name: ACCOUNTS.reader.user.displayName,
  avatarColor: ACCOUNTS.reader.user.avatarColor,
  bio: ACCOUNTS.reader.user.bio,
  favoriteGenres: ACCOUNTS.reader.user.favoriteGenres,
})
mergePerson(ACCOUNTS.author.user.username, {
  name: ACCOUNTS.author.user.displayName,
  avatarColor: ACCOUNTS.author.user.avatarColor,
  bio: ACCOUNTS.author.user.bio,
  favoriteGenres: ACCOUNTS.author.user.favoriteGenres,
  isAuthor: true,
})

for (const person of people.values()) {
  await ensureProfile(person.handle, person)
}
console.log(`[seed] ensured ${people.size} profiles`)

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

const tagIdBySlug = new Map()

async function ensureTag(displayName) {
  const slug = slugifyTag(displayName)
  if (tagIdBySlug.has(slug)) return tagIdBySlug.get(slug)

  const { data: existing, error: selErr } = await supabase
    .from('tags')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (selErr) fail(`looking up tag "${displayName}": ${selErr.message}`)

  if (existing) {
    tagIdBySlug.set(slug, existing.id)
    return existing.id
  }

  // First writer of a tag's slug sets its display casing (see plan: "Content"
  // section on tags) — plain insert rather than upsert so a later story with
  // different casing of the same tag never overwrites it.
  const { data: inserted, error: insErr } = await supabase
    .from('tags')
    .insert({ slug, display_name: displayName })
    .select('id')
    .single()
  if (insErr) fail(`creating tag "${displayName}": ${insErr.message}`)

  tagIdBySlug.set(slug, inserted.id)
  return inserted.id
}

// ---------------------------------------------------------------------------
// Stories, chapters, paragraphs
// ---------------------------------------------------------------------------

// Populated while seeding chapters/paragraphs, then reused when anchoring
// comments below.
const chapterIdByKey = new Map() // `${slug}:${number}` -> chapter uuid
const paragraphIdByKey = new Map() // `${slug}:${number}:${ordinal}` -> paragraph uuid
const paragraphTextByKey = new Map() // same key -> paragraph body text

for (const story of stories) {
  const authorId = profileIdByHandle.get(story.author.handle)
  if (!authorId) fail(`no profile resolved for story author @${story.author.handle}`)

  const storyId = deterministicUuid(`story:${story.slug}`)

  const { error: storyErr } = await supabase.from('stories').upsert(
    {
      id: storyId,
      slug: story.slug,
      author_id: authorId,
      title: story.title,
      blurb: story.blurb,
      synopsis: story.synopsis,
      cover_color: story.coverColor,
      status: story.status,
      is_published: true,
      updated_at: story.updatedAt,
    },
    { onConflict: 'id' },
  )
  if (storyErr) fail(`upserting story "${story.slug}": ${storyErr.message}`)

  const tagIds = []
  for (const tagName of story.tags ?? []) {
    tagIds.push(await ensureTag(tagName))
  }
  if (tagIds.length > 0) {
    const { error: tagLinkErr } = await supabase
      .from('story_tags')
      .upsert(
        tagIds.map((tagId) => ({ story_id: storyId, tag_id: tagId })),
        { onConflict: 'story_id,tag_id', ignoreDuplicates: true },
      )
    if (tagLinkErr) fail(`linking tags for "${story.slug}": ${tagLinkErr.message}`)
  }

  for (const chapter of story.chapters ?? []) {
    const chapterId = deterministicUuid(`chapter:${chapter.id}`)
    chapterIdByKey.set(`${story.slug}:${chapter.number}`, chapterId)

    const { error: chapterErr } = await supabase.from('chapters').upsert(
      {
        id: chapterId,
        story_id: storyId,
        number: chapter.number,
        title: chapter.title,
        state: 'published',
        hidden: false,
        locked: Boolean(chapter.locked),
        // stories.json has no per-chapter timestamp; approximate with the
        // story's updatedAt. Fine for dev seed data, not meant to be exact.
        published_at: story.updatedAt,
        word_count: chapter.wordCount ?? 0,
      },
      { onConflict: 'id' },
    )
    if (chapterErr) fail(`upserting chapter "${chapter.id}": ${chapterErr.message}`)

    const paragraphRows = (chapter.paragraphs ?? []).map((body, ordinal) => {
      const key = `${story.slug}:${chapter.number}:${ordinal}`
      const id = deterministicUuid(`paragraph:${chapter.id}:${ordinal}`)
      paragraphIdByKey.set(key, id)
      paragraphTextByKey.set(key, body)
      return { id, chapter_id: chapterId, ordinal, body, deleted_at: null }
    })

    if (paragraphRows.length > 0) {
      const { error: paraErr } = await supabase.from('paragraphs').upsert(paragraphRows, { onConflict: 'id' })
      if (paraErr) fail(`upserting paragraphs for "${chapter.id}": ${paraErr.message}`)
    }

    // If a rerun ever shrinks a chapter's paragraph count, drop the excess
    // rather than leaving stale ones behind.
    const { error: pruneErr } = await supabase
      .from('paragraphs')
      .delete()
      .eq('chapter_id', chapterId)
      .gte('ordinal', paragraphRows.length)
    if (pruneErr) fail(`pruning stale paragraphs for "${chapter.id}": ${pruneErr.message}`)
  }

  console.log(`[seed] story "${story.slug}" — ${story.chapters?.length ?? 0} chapters`)
}

// ---------------------------------------------------------------------------
// Comments (+ one level of replies)
// ---------------------------------------------------------------------------

let commentCount = 0

for (const [anchorKey, comments] of Object.entries(COMMENT_SEED)) {
  const [slug, chapterNumberRaw, paragraphIndexRaw] = anchorKey.split('/')
  const chapterNumber = Number(chapterNumberRaw)
  const paragraphIndex = paragraphIndexRaw === undefined ? null : Number(paragraphIndexRaw)

  const chapterId = chapterIdByKey.get(`${slug}:${chapterNumber}`)
  if (!chapterId) fail(`comment anchor "${anchorKey}" references an unknown chapter`)

  let paragraphId = null
  let snapshot = null
  if (paragraphIndex !== null) {
    const key = `${slug}:${chapterNumber}:${paragraphIndex}`
    paragraphId = paragraphIdByKey.get(key)
    if (!paragraphId) fail(`comment anchor "${anchorKey}" references an unknown paragraph`)
    snapshot = (paragraphTextByKey.get(key) ?? '').slice(0, 200)
  }

  for (const comment of comments) {
    const commentId = deterministicUuid(`comment:${comment.id}`)
    const authorId = profileIdByHandle.get(comment.author.handle)
    if (!authorId) fail(`comment author @${comment.author.handle} has no profile`)

    const { error: commentErr } = await supabase.from('comments').upsert(
      {
        id: commentId,
        author_id: authorId,
        chapter_id: chapterId,
        paragraph_id: paragraphId,
        parent_id: null,
        body: comment.body,
        body_snapshot: snapshot,
        created_at: new Date(comment.createdAt).toISOString(),
      },
      { onConflict: 'id' },
    )
    if (commentErr) fail(`upserting comment "${comment.id}": ${commentErr.message}`)
    commentCount += 1

    for (const reply of comment.replies ?? []) {
      const replyId = deterministicUuid(`comment:${reply.id}`)
      const replyAuthorId = profileIdByHandle.get(reply.author.handle)
      if (!replyAuthorId) fail(`reply author @${reply.author.handle} has no profile`)

      const { error: replyErr } = await supabase.from('comments').upsert(
        {
          id: replyId,
          author_id: replyAuthorId,
          chapter_id: chapterId,
          paragraph_id: paragraphId,
          parent_id: commentId,
          body: reply.body,
          body_snapshot: snapshot,
          created_at: new Date(reply.createdAt).toISOString(),
        },
        { onConflict: 'id' },
      )
      if (replyErr) fail(`upserting reply "${reply.id}": ${replyErr.message}`)
      commentCount += 1
    }
  }
}

console.log(`[seed] upserted ${commentCount} comments (including replies)`)

// ---------------------------------------------------------------------------
// Baseline paragraph likes
//
// The schema has no stored counter columns (counts are plain count(*)), so
// the prototype's fabricated PARAGRAPH_LIKE_SEED numbers are realized as
// real paragraph_likes rows from a small pool of synthetic "liker" profiles,
// shared across anchors and created once.
// ---------------------------------------------------------------------------

const LIKER_PALETTE = ['#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#f43f5e', '#a855f7', '#3b82f6']
const maxLikers = Object.values(PARAGRAPH_LIKE_SEED).reduce((max, n) => Math.max(max, n), 0)

const likerIds = []
for (let i = 1; i <= maxLikers; i++) {
  const handle = `seed-liker-${String(i).padStart(2, '0')}`
  const id = await ensureProfile(handle, {
    name: `Seed Liker ${i}`,
    avatarColor: LIKER_PALETTE[i % LIKER_PALETTE.length],
  })
  likerIds.push(id)
}

let likeCount = 0
for (const [anchorKey, count] of Object.entries(PARAGRAPH_LIKE_SEED)) {
  const [slug, chapterNumberRaw, paragraphIndexRaw] = anchorKey.split('/')
  const key = `${slug}:${Number(chapterNumberRaw)}:${Number(paragraphIndexRaw)}`
  const paragraphId = paragraphIdByKey.get(key)
  if (!paragraphId) fail(`paragraph like anchor "${anchorKey}" references an unknown paragraph`)

  const rows = likerIds.slice(0, count).map((profileId) => ({ profile_id: profileId, target_id: paragraphId }))
  if (rows.length === 0) continue

  const { error: likeErr } = await supabase
    .from('paragraph_likes')
    .upsert(rows, { onConflict: 'profile_id,target_id', ignoreDuplicates: true })
  if (likeErr) fail(`seeding paragraph likes for "${anchorKey}": ${likeErr.message}`)
  likeCount += rows.length
}

console.log(`[seed] ensured ${likeCount} paragraph_likes rows across ${likerIds.length} synthetic likers`)
console.log('[seed] done.')
