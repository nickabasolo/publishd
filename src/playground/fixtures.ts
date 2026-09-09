// Loose, hand-written fixture data for the /playground sandboxes.
//
// Deliberately NOT importing the strict `Story`/`Chapter` types from
// `@/lib/types` (the real DataClient contract) — these objects only carry
// the fields the presentational components we're feeding actually read.
// If the real contract changes shape, this file should keep working
// unchanged, because it isn't type-checked against it.

export type PgAuthor = {
  name: string
  handle: string
  avatarColor: string
}

export type PgChapter = {
  id: string
  number: number
  title: string
  wordCount: number
  locked?: boolean
  paragraphs: string[]
  speakers?: ('a' | 'b')[]
}

export type PgStory = {
  id: string
  slug: string
  publicId: string
  title: string
  author: PgAuthor
  tags: string[]
  status: 'ongoing' | 'complete'
  blurb: string
  synopsis: string
  coverColor: string
  updatedAt: string
  newChapters: number
  stats: { hits: number; comments: number; likes: number }
  chapters: PgChapter[]
  format?: 'prose' | 'chat'
  chatParticipants?: { a: { name: string; color: string }; b: { name: string; color: string } }
}

// ---------------------------------------------------------------------------
// Prose story + chapter
// ---------------------------------------------------------------------------

export const proseStory: PgStory = {
  id: 'pg-1',
  slug: 'the-last-lighthouse',
  publicId: '119284',
  title: 'The Last Lighthouse',
  author: { name: 'Rowan Ashby', handle: 'rowanashby', avatarColor: '#7c3aed' },
  tags: ['slow-burn', 'coastal', 'found-family', 'melancholy'],
  status: 'ongoing',
  blurb: 'A keeper who refuses to leave, and the storm that finally makes her.',
  synopsis: 'Mira has kept the light burning for eleven years after the town emptied out below her.',
  coverColor: '#1e3a5f',
  updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  newChapters: 1,
  stats: { hits: 48213, comments: 342, likes: 5104 },
  chapters: [
    {
      id: 'pg-1-c1',
      number: 1,
      title: 'The Keeper',
      wordCount: 1240,
      paragraphs: [
        'The light turned twice a minute, same as it had for eleven years, same as it would tonight whether or not anyone below the cliff still cared to watch for it.',
        'Mira climbed the last flight without counting the steps anymore. She had stopped counting somewhere around year four.',
        'Below, the town was a scatter of dark windows and one porch light that never went out, because old Hollis refused to sleep in the dark, storm or no storm.',
      ],
    },
    {
      id: 'pg-1-c2',
      number: 2,
      title: 'Weather Coming',
      wordCount: 980,
      paragraphs: [
        'The radio said forty-knot gusts by midnight. Mira had stopped trusting the radio around the same year she stopped counting steps.',
        'She checked the lamp housing, the fuel line, the little brass latch that always rattled loose first.',
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Chat-format story + chapter
// ---------------------------------------------------------------------------

export const chatStory: PgStory = {
  id: 'pg-2',
  slug: 'texts-from-the-void',
  publicId: '774102',
  title: 'Texts From the Void',
  author: { name: 'Kai Okoro', handle: 'kaiokoro', avatarColor: '#ea580c' },
  tags: ['chat-fic', 'comedy', 'sci-fi', 'au'],
  status: 'ongoing',
  blurb: 'Two strangers, one crossed wire between dimensions, and a group chat that should not exist.',
  synopsis: "Priya's phone starts receiving texts from someone who insists it's the year 2231.",
  coverColor: '#4c1d95',
  updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  newChapters: 2,
  stats: { hits: 91042, comments: 1208, likes: 12933 },
  format: 'chat',
  chatParticipants: {
    a: { name: 'Priya', color: '#7c3aed' },
    b: { name: 'Unknown Number', color: '#059669' },
  },
  chapters: [
    {
      id: 'pg-2-c1',
      number: 1,
      title: 'wrong number??',
      wordCount: 210,
      speakers: ['a', 'b', 'a'],
      paragraphs: [
        "who is this and why do you keep texting me about 'the second moon'",
        "apologies. cross-relay bleed, third time this cycle. you are receiving signal meant for 2231.",
        'ok so youre either a bot, a cult, or the most committed prank caller ive ever met',
      ],
    },
    {
      id: 'pg-2-c2',
      number: 2,
      title: 'the second moon, actually',
      wordCount: 260,
      speakers: ['b', 'a', 'b'],
      paragraphs: [
        'it was installed in 2189. artificial. mostly for the tides, partly for the view.',
        'installed. like a light fixture.',
        'yes. exactly like that. you are surprisingly quick for someone from the signal-poor era.',
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Home-feed-style story arrays, for layout experimentation
// ---------------------------------------------------------------------------

function feedStory(overrides: Partial<PgStory>): PgStory {
  return {
    id: overrides.id ?? 'pg-feed',
    slug: overrides.slug ?? 'untitled',
    publicId: overrides.publicId ?? '000000',
    title: overrides.title ?? 'Untitled',
    author: overrides.author ?? { name: 'Anon', handle: 'anon', avatarColor: '#6b7280' },
    tags: overrides.tags ?? [],
    status: overrides.status ?? 'ongoing',
    blurb: overrides.blurb ?? '',
    synopsis: overrides.synopsis ?? '',
    coverColor: overrides.coverColor ?? '#334155',
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    newChapters: overrides.newChapters ?? 0,
    stats: overrides.stats ?? { hits: 0, comments: 0, likes: 0 },
    chapters: overrides.chapters ?? [
      { id: 'c1', number: 1, title: 'Chapter One', wordCount: 800, paragraphs: ['Placeholder paragraph.'] },
    ],
    format: overrides.format,
    chatParticipants: overrides.chatParticipants,
  }
}

/** Short feed: a handful of stories, all with covers, varying tag counts. */
export const feedShort: PgStory[] = [
  feedStory({
    id: 'f1',
    slug: 'moth-and-flame',
    publicId: '331201',
    title: 'Moth and Flame',
    author: { name: 'Lena Voss', handle: 'lenavoss', avatarColor: '#dc2626' },
    tags: ['romance', 'enemies-to-lovers'],
    coverColor: '#7f1d1d',
    stats: { hits: 22011, comments: 89, likes: 1904 },
  }),
  feedStory({
    id: 'f2',
    slug: 'the-quiet-war',
    publicId: '331202',
    title: 'The Quiet War',
    author: { name: 'Sam Ito', handle: 'samito', avatarColor: '#0369a1' },
    tags: ['fantasy', 'politics', 'slow-burn', 'war'],
    status: 'complete',
    coverColor: '#0c4a6e',
    stats: { hits: 154002, comments: 2310, likes: 18400 },
    newChapters: 0,
  }),
  chatStory,
]

/** Long feed: many entries, some missing covers/tags, to stress-test layouts. */
export const feedLong: PgStory[] = [
  ...feedShort,
  proseStory,
  feedStory({
    id: 'f3',
    slug: 'no-cover-story',
    publicId: '331203',
    title: 'A Story With No Cover Color Set',
    author: { name: 'J', handle: 'j', avatarColor: '#6b7280' },
    tags: [],
    coverColor: '',
    stats: { hits: 12, comments: 0, likes: 1 },
  }),
  feedStory({
    id: 'f4',
    slug: 'tag-heavy',
    publicId: '331204',
    title: 'A Story With Way Too Many Tags',
    author: { name: 'Multi Tagger', handle: 'multitagger', avatarColor: '#16a34a' },
    tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    coverColor: '#14532d',
    stats: { hits: 990, comments: 4, likes: 60 },
  }),
  feedStory({
    id: 'f5',
    slug: 'single-chapter',
    publicId: '331205',
    title: 'One and Done',
    author: { name: 'Fin', handle: 'fin', avatarColor: '#9333ea' },
    tags: ['oneshot'],
    status: 'complete',
    coverColor: '#581c87',
    stats: { hits: 5023, comments: 12, likes: 340 },
  }),
]

/** Empty feed: for testing empty-state layouts. */
export const feedEmpty: PgStory[] = []
