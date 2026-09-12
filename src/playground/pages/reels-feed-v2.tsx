// DESIGN EXPLORATION v2 — Redesign of reels-feed.tsx: same underlying fake
// content + gesture mechanics (vertical snap feed, axis-locked drag carousel,
// double-tap-to-like), but a different visual language and IA per the
// human's sketches: light/dark "paper card on neutral page" look matching
// the real app's tokens, underlined-text tags, single-line author row, a
// next-slide "peek" instead of dot pagination, inline actions row with a
// decorative comment box, and new entrance/caption/simulated-comment
// animations. Fully self-contained, hardcoded Lorem Ipsum + K-pop-fic data.
// Not wired to any real data layer, no navigation to real routes. Playground
// page only — throwaway. `reels-feed.tsx` is left untouched as a separate
// design option to compare against.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Heart, MessageCircle, Share2, Bookmark, X, ChevronLeft, Compass, Search, PenLine, Library, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Fake data (duplicated from reels-feed.tsx so the two pages stay independent)
// ---------------------------------------------------------------------------

type Author = { name: string; handle: string; color: string }

const AUTHORS: Author[] = [
  { name: 'Rosalind Okafor', handle: 'rosalindo', color: '#7c5cff' },
  { name: 'Marguerite Delacroix', handle: 'mdela', color: '#e0623a' },
  { name: 'Theo Vance', handle: 'theov', color: '#2f9e6f' },
  { name: 'Priya Anand', handle: 'priyaa', color: '#d94f8c' },
  { name: 'Sam Whitlock', handle: 'samw', color: '#c98a1f' },
]

const FAKE_COMMENTERS = [
  { name: 'Odalys Fenn', handle: 'odalysf', color: '#3a8de0' },
  { name: 'Bram Castellan', handle: 'bramc', color: '#e0a23a' },
  { name: 'Yuki Serrano', handle: 'yukis', color: '#8c5cd9' },
  { name: 'Juno Ackerley', handle: 'junoa', color: '#2f9e6f' },
  { name: 'Devrim Okonkwo', handle: 'devrimo', color: '#e0623a' },
]

const FAKE_COMMENTS = [
  'Lorem ipsum dolor sit amet, this hit way harder than expected.',
  'Consectetur adipiscing elit — the ending genuinely got me.',
  'Sed do eiusmod tempor incididunt, need a part two immediately.',
  'Ut enim ad minim veniam, the pacing here is perfect.',
  'Duis aute irure dolor in reprehenderit, saving this one.',
  'Excepteur sint occaecat cupidatat non proident, reread it twice already.',
]

/** Very short fake "live" comments used for the new simulated-comments animation below the author row. */
const LIVE_COMMENTS = [
  'omg the pacing 😭',
  'need this NOW',
  'not me rereading this',
  'the way i gasped',
  'save this immediately',
  'okay but the ending??',
]

interface DrabbleItem {
  id: string
  type: 'drabble'
  author: Author
  title: string
  text: string
  likes: number
  comments: number
  tags: string[]
  note?: string
  chapter?: { current: number; total: number | null; work: string }
}

interface LongformItem {
  id: string
  type: 'longform'
  author: Author
  title: string
  intro: string
  likes: number
  comments: number
  tags: string[]
  note?: string
  chapter?: { current: number; total: number | null; work: string }
}

interface ChatItem {
  id: string
  type: 'chat'
  author: Author
  title: string
  participants: { a: { name: string; color: string }; b: { name: string; color: string } }
  messages: { speaker: 'a' | 'b'; text: string }[]
  likes: number
  comments: number
  tags: string[]
  note?: string
}

type FeedItem = DrabbleItem | LongformItem | ChatItem

const FEED: FeedItem[] = [
  {
    id: 'd1',
    type: 'drabble',
    author: AUTHORS[0],
    title: 'The Glass Orchard',
    text: 'Lorem ipsum dolor sit amet, the orchard hummed at dusk. Each tree held a memory instead of fruit, and she picked the ripest one — her mother\'s laugh, still warm. Consectetur adipiscing elit, the gardener never told anyone what she\'d done.',
    likes: 482,
    comments: 31,
    tags: ['fluff', 'magical realism', 'hurt/comfort'],
    note: 'based on a request 🥺',
  },
  {
    id: 'c1',
    type: 'chat',
    author: AUTHORS[1],
    title: 'Static on the Line',
    participants: { a: { name: 'Nova', color: '#2f9e6f' }, b: { name: 'Kest', color: '#e0623a' } },
    messages: [
      { speaker: 'a', text: 'lorem ipsum, you still up?' },
      { speaker: 'b', text: 'dolor sit amet. always. what happened' },
      { speaker: 'a', text: 'the relay went dark again. same frequency as before' },
      { speaker: 'b', text: 'consectetur adipiscing elit — that\'s the third time this week' },
      { speaker: 'a', text: 'i think it\'s trying to say something' },
      { speaker: 'b', text: 'then let\'s listen' },
    ],
    likes: 901,
    comments: 118,
    tags: ['sci-fi au', 'slow burn', 'college au', 'pining'],
  },
  {
    id: 'l1',
    type: 'longform',
    author: AUTHORS[2],
    title: 'Harbor of Small Regrets',
    intro:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. The lighthouse keeper counted ships the way other men counted sheep, and on the night the storm rolled in, he counted one that shouldn\'t have existed. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua — a hull with no name, running dark against the swell.',
    likes: 1240,
    comments: 76,
    tags: ['angst', 'slow burn', 'mystery'],
    note: 'unbeta\'d, we die like fans',
    chapter: { current: 5, total: null, work: 'The Salt Cathedral' },
  },
  {
    id: 'd2',
    type: 'drabble',
    author: AUTHORS[3],
    title: 'Ninety Seconds',
    text: 'Ut enim ad minim veniam: the elevator stalled between floors, and for ninety seconds they said everything they\'d been too polite to say for ninety days. Quis nostrud exercitation ullamco laboris — then the lights flickered back on, and so did the silence.',
    likes: 356,
    comments: 22,
    tags: ['fluff', 'strangers to lovers'],
  },
  {
    id: 'l2',
    type: 'longform',
    author: AUTHORS[4],
    title: 'The Cartographer\'s Debt',
    intro:
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore. He\'d mapped every coastline on the continent except his own hometown, and everyone had a theory why. Excepteur sint occaecat cupidatat non proident — the truth was smaller and sadder than any of them.',
    likes: 689,
    comments: 54,
    tags: ['hurt/comfort', 'found family', 'mystery', 'slow burn'],
    note: 'based on a request 🥺',
    chapter: { current: 12, total: 20, work: 'The Cartographer\'s Debt' },
  },
  {
    id: 'c2',
    type: 'chat',
    author: AUTHORS[0],
    title: 'Group Project, 2am',
    participants: { a: { name: 'Wren', color: '#d94f8c' }, b: { name: 'Ash', color: '#c98a1f' } },
    messages: [
      { speaker: 'b', text: 'lorem ipsum are you actually awake' },
      { speaker: 'a', text: 'dolor sit amet unfortunately yes' },
      { speaker: 'b', text: 'ok so hear me out. what if the ending is a flashback' },
      { speaker: 'a', text: 'consectetur.... adipiscing elit i hate that i love it' },
      { speaker: 'b', text: 'RIGHT' },
    ],
    likes: 214,
    comments: 19,
    tags: ['college au', 'fluff', 'crack'],
  },
  {
    id: 'd3',
    type: 'drabble',
    author: AUTHORS[1],
    title: 'Inventory',
    text: 'Sed ut perspiciatis unde omnis iste natus error: she kept a list of things she\'d never say out loud, filed alphabetically, updated weekly. Sit voluptatem accusantium doloremque laudantium — under "M" there was only one entry, and it hadn\'t changed in years.',
    likes: 527,
    comments: 40,
    tags: ['angst', 'unrequited love'],
    note: 'unbeta\'d, we die like fans',
  },
  {
    id: 'l3',
    type: 'longform',
    author: AUTHORS[2],
    title: 'Second Hand Weather',
    intro:
      'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit. The weather machine had been broken for a decade, but the old man still climbed the tower every morning to turn its dead crank. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet — someone had to keep pretending.',
    likes: 803,
    comments: 61,
    tags: ['slice of life', 'bittersweet', 'found family'],
    chapter: { current: 3, total: null, work: 'Second Hand Weather' },
  },
  {
    id: 'c3',
    type: 'chat',
    author: AUTHORS[3],
    title: 'The Long Way Home',
    participants: { a: { name: 'Idris', color: '#7c5cff' }, b: { name: 'Faye', color: '#2f9e6f' } },
    messages: [
      { speaker: 'a', text: 'lorem ipsum dolor, train\'s delayed again' },
      { speaker: 'b', text: 'sit amet consectetur, of course it is' },
      { speaker: 'a', text: 'adipiscing elit sed do — wanna just walk instead? it\'s not that far' },
      { speaker: 'b', text: 'eiusmod tempor incididunt, in this weather??' },
      { speaker: 'a', text: 'ut labore et dolore, i brought two umbrellas' },
      { speaker: 'b', text: 'magna aliqua... okay fine. lead the way' },
    ],
    likes: 445,
    comments: 28,
    tags: ['fluff', 'slow burn', 'rainy day'],
    note: 'based on a request 🥺',
  },
  {
    id: 'd4',
    type: 'drabble',
    author: AUTHORS[4],
    title: 'Return Policy',
    text: 'Ut enim ad minima veniam, quis nostrum exercitationem ullam: the shop only accepted returns of things that had never truly belonged to you. He\'d been standing in line for three hours with a heart he swore wasn\'t his. Corporis suscipit laboriosam — the clerk just smiled and reached for the ledger.',
    likes: 612,
    comments: 47,
    tags: ['magical realism', 'bittersweet'],
  },
  {
    id: 'l4',
    type: 'longform',
    author: AUTHORS[0],
    title: 'The Understudy',
    intro:
      'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium. She\'d played the same role for eleven years without ever going on, and when the call finally came, she almost said no. Voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi — almost.',
    likes: 958,
    comments: 83,
    tags: ['found family', 'slow burn', 'hurt/comfort'],
    note: 'unbeta\'d, we die like fans',
    chapter: { current: 8, total: 15, work: 'The Understudy' },
  },
]

const FOLLOWING_AUTHORS: Author[] = [
  { name: 'Haeun Song', handle: 'jaeminluvr', color: '#d94f8c' },
  { name: 'Callum Reyes', handle: 'omegafics', color: '#3a8de0' },
  { name: 'Mireille Tanaka', handle: 'minhyukfilms', color: '#7c5cff' },
  { name: 'Jonah Ackerman', handle: 'omega_archivist', color: '#2f9e6f' },
]

const FOLLOWING: FeedItem[] = [
  {
    id: 'fd1',
    type: 'drabble',
    author: FOLLOWING_AUTHORS[0],
    title: 'Green Room, 11:58PM',
    text: 'Jaehyun counts the mic checks under his breath, three fingers tapping his knee — the same tic he\'s had since trainee days. Beside him, Minhyuk passes a water bottle without being asked. "You\'re going to be fine," Minhyuk says, not looking up from his own reflection. "You always say that." "I\'m always right." Two minutes to OMEGA\'s stage.',
    likes: 2104,
    comments: 189,
    tags: ['omega', 'jaehyun x minhyuk', 'pre-debut', 'fluff'],
    note: 'based on a request 🥺',
  },
  {
    id: 'fc1',
    type: 'chat',
    author: FOLLOWING_AUTHORS[1],
    title: 'dorm group chat (OMEGA)',
    participants: { a: { name: 'Jaehyun', color: '#e0623a' }, b: { name: 'Minhyuk', color: '#c98a1f' } },
    messages: [
      { speaker: 'a', text: 'who ate my leftover tteokbokki i am not joking' },
      { speaker: 'b', text: 'it was sitting out for two days jaehyun. it was a public health decision' },
      { speaker: 'a', text: 'a PUBLIC. HEALTH. DECISION.' },
      { speaker: 'b', text: 'i\'ll buy you a new one before the fan sign, i promise' },
      { speaker: 'a', text: 'fine. but i\'m telling the manager it was you if he asks about the fridge smell' },
      { speaker: 'b', text: 'that\'s so unfair and also completely valid' },
    ],
    likes: 3350,
    comments: 402,
    tags: ['omega', 'jaehyun x minhyuk', 'chat au', 'crack'],
    note: 'unbeta\'d, we die like fans',
  },
  {
    id: 'fl1',
    type: 'longform',
    author: FOLLOWING_AUTHORS[2],
    title: 'Comeback Week',
    intro:
      'The countdown clock in the practice room read six days, and Minhyuk still hadn\'t landed the last eight-count clean. Jaehyun watched from the mirror instead of the door, which was how he always knew something was wrong before Minhyuk said a word. "You\'re rushing the turn because you\'re scared of the formation change," Jaehyun said. "I know my own choreo." "Then stop fighting it." Six days. Five, after tonight.',
    likes: 4210,
    comments: 297,
    tags: ['omega', 'jaehyun x minhyuk', 'slow burn', 'comeback era'],
    chapter: { current: 4, total: null, work: 'Comeback Week' },
  },
  {
    id: 'fd2',
    type: 'drabble',
    author: FOLLOWING_AUTHORS[3],
    title: 'Trainee Room 4B',
    text: 'Before OMEGA had a name, they had a room with bad lighting and a mirror wall that lied about how far they\'d come. Jaehyun learned harmony parts by humming them into his pillow at 2AM so the RA wouldn\'t hear. Minhyuk learned to sleep sitting up. Neither of them thought they\'d debut together. Neither of them was wrong to hope anyway.',
    likes: 1892,
    comments: 144,
    tags: ['omega', 'jaehyun x minhyuk', 'pre-debut', 'angst'],
  },
  {
    id: 'fc2',
    type: 'chat',
    author: FOLLOWING_AUTHORS[0],
    title: 'texting during soundcheck',
    participants: { a: { name: 'Minhyuk', color: '#d94f8c' }, b: { name: 'Jaehyun', color: '#2f9e6f' } },
    messages: [
      { speaker: 'b', text: 'did you see the setlist change. we\'re opening with the b-side now' },
      { speaker: 'a', text: 'WHAT. that\'s the one with my solo run i haven\'t warmed up for' },
      { speaker: 'b', text: 'breathe. you\'ve hit that note in your sleep, literally, i\'ve heard you' },
      { speaker: 'a', text: 'that is deeply embarrassing information and also comforting somehow' },
      { speaker: 'b', text: 'that\'s kind of our whole dynamic though' },
    ],
    likes: 2648,
    comments: 231,
    tags: ['omega', 'jaehyun x minhyuk', 'chat au', 'fluff'],
    note: 'based on a request 🥺',
  },
  {
    id: 'fl2',
    type: 'longform',
    author: FOLLOWING_AUTHORS[1],
    title: 'The Understudy Slot',
    intro:
      'Minhyuk had been the backup center for two full eras before anyone outside the company knew his name. He\'d memorized every formation from every angle, just in case, and never once let it show on his face when "just in case" didn\'t happen. Then Jaehyun turned his ankle three days before the award show, and the choreographer looked straight at Minhyuk and said the sentence he\'d rehearsed hearing for years.',
    likes: 3804,
    comments: 288,
    tags: ['omega', 'jaehyun x minhyuk', 'slow burn', 'hurt/comfort'],
    note: 'unbeta\'d, we die like fans',
    chapter: { current: 7, total: 12, work: 'The Understudy Slot' },
  },
  {
    id: 'fd3',
    type: 'drabble',
    author: FOLLOWING_AUTHORS[2],
    title: 'Fan Sign Nerves',
    text: 'Riho signed the same photocard for the ninetieth time and still meant it every time, even when her wrist ached and the marker was running dry. A fan slid a handwritten note across the table instead of asking a question. Riho read three words of it, looked up, and had to blink hard before she could smile again.',
    likes: 1271,
    comments: 92,
    tags: ['omega', 'riho', 'slice of life'],
  },
  {
    id: 'fl3',
    type: 'longform',
    author: FOLLOWING_AUTHORS[3],
    title: 'Encore',
    intro:
      'Nobody had told OMEGA the tour was ending after this city, but Jaehyun could feel it in the way the crew kept hugging them a second too long between sets. On the last chorus of the encore, Minhyuk grabbed his hand mid-choreo — half a beat off the count, completely against the formation — and neither of them let go until the lights actually came up.',
    likes: 5102,
    comments: 411,
    tags: ['omega', 'jaehyun x minhyuk', 'tour era', 'slow burn'],
    note: 'based on a request 🥺',
    chapter: { current: 20, total: 20, work: 'Encore' },
  },
  {
    id: 'fc3',
    type: 'chat',
    author: FOLLOWING_AUTHORS[3],
    title: 'airport chat, 4am flight',
    participants: { a: { name: 'Jaehyun', color: '#7c5cff' }, b: { name: 'Minhyuk', color: '#e0a23a' } },
    messages: [
      { speaker: 'a', text: 'gate change again. we\'re at C22 now' },
      { speaker: 'b', text: 'of course we are. i just bought coffee at the other end of the terminal' },
      { speaker: 'a', text: 'bring it anyway. i\'m not carrying my own bag AND being caffeine-deprived today' },
      { speaker: 'b', text: 'the manager is going to leave us both here' },
      { speaker: 'a', text: 'he loves us too much for that. probably' },
    ],
    likes: 2933,
    comments: 265,
    tags: ['omega', 'jaehyun x minhyuk', 'chat au', 'domestic'],
  },
  {
    id: 'fd4',
    type: 'drabble',
    author: FOLLOWING_AUTHORS[1],
    title: 'Practice Room, After Hours',
    text: 'Minhyuk kept the lights low and the music lower, running the bridge one more time even though everyone else had gone back to the dorm. He wasn\'t chasing perfect. He was chasing the exact half-second where the choreo stopped feeling like counting and started feeling like flying. Tonight, on the eleventh try, Jaehyun leaned in the doorway and watched him find it — and neither of them said anything about why they both smiled.',
    likes: 1940,
    comments: 139,
    tags: ['omega', 'jaehyun x minhyuk', 'slow burn'],
  },
]

const FAKE_SEARCH_RESULTS = [
  { title: 'The Glass Orchard', author: AUTHORS[0], kind: 'Story' },
  { title: 'Static on the Line', author: AUTHORS[1], kind: 'Story' },
  { title: 'Harbor of Small Regrets', author: AUTHORS[2], kind: 'Story' },
  { title: 'Priya Anand', author: AUTHORS[3], kind: 'Author' },
  { title: 'slow burn', author: AUTHORS[4], kind: 'Tag' },
]

const FAKE_LIBRARY_ITEMS = [
  { title: 'Harbor of Small Regrets', author: AUTHORS[2], progress: 62 },
  { title: 'Comeback Week', author: FOLLOWING_AUTHORS[2], progress: 18 },
  { title: 'The Cartographer\'s Debt', author: AUTHORS[4], progress: 91 },
  { title: 'Encore', author: FOLLOWING_AUTHORS[3], progress: 40 },
]

const FAKE_NOTIFICATIONS = [
  { person: FAKE_COMMENTERS[0], text: 'liked your story', time: '2h ago' },
  { person: FAKE_COMMENTERS[1], text: 'commented on your chapter', time: '4h ago' },
  { person: FAKE_COMMENTERS[2], text: 'started following you', time: '6h ago' },
  { person: FAKE_COMMENTERS[3], text: 'liked your story', time: '1d ago' },
  { person: FAKE_COMMENTERS[4], text: 'mentioned you in a comment', time: '2d ago' },
  { person: FAKE_COMMENTERS[0], text: 'started following you', time: '3d ago' },
]

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function MiniAvatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-paper/70 dark:ring-night/70"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

function fmtCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)
}

// ---------------------------------------------------------------------------
// Double-tap-to-like: unchanged mechanics from reels-feed.tsx — wraps a
// card's content, detects two taps within 300ms, fires a big center heart
// burst.
// ---------------------------------------------------------------------------

function DoubleTapLike({
  children,
  onDoubleTap,
}: {
  children: React.ReactNode
  onDoubleTap: () => void
}) {
  const lastTapRef = useRef(0)
  const [burstKey, setBurstKey] = useState(0)
  const [burstVisible, setBurstVisible] = useState(false)

  const handleTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0
      onDoubleTap()
      setBurstKey((k) => k + 1)
      setBurstVisible(true)
      window.setTimeout(() => setBurstVisible(false), 650)
    } else {
      lastTapRef.current = now
    }
  }

  return (
    <div className="absolute inset-0 z-10" onClick={handleTap}>
      {children}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <Heart
          key={burstKey}
          className={cn(
            'h-28 w-28 fill-rose-500 text-rose-500 drop-shadow-xl transition-all duration-500 ease-out',
            burstVisible ? 'scale-100 opacity-90' : 'scale-[1.6] opacity-0',
          )}
          strokeWidth={1}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fake comment sheet — bottom sheet with hardcoded Lorem Ipsum comments.
// Purely a visual mock, restyled to the light/dark paper theme.
// ---------------------------------------------------------------------------

function CommentSheet({
  open,
  onClose,
  count,
}: {
  open: boolean
  onClose: () => void
  count: number
}) {
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    const timer = window.setTimeout(() => setMounted(false), 300)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!mounted) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className={cn(
          'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
          shown ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative z-10 flex max-h-[75vh] flex-col rounded-t-2xl bg-paper pb-[env(safe-area-inset-bottom)] text-ink shadow-2xl transition-transform duration-300 ease-out dark:bg-surface-night dark:text-stone-200"
        style={{ transform: shown ? 'translateY(0)' : 'translateY(100%)' }}
      >
        <div className="flex justify-center pt-2.5">
          <div className="h-1 w-10 rounded-full bg-ink/15 dark:bg-white/20" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <span className="font-sans text-sm font-semibold">{fmtCount(count)} comments</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close comments"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          <div className="flex flex-col gap-4 pb-4">
            {FAKE_COMMENTERS.map((commenter, i) => (
              <div key={commenter.handle} className="flex items-start gap-3">
                <MiniAvatar name={commenter.name} color={commenter.color} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-sans text-[13px] font-semibold">{commenter.name}</span>
                    <span className="font-sans text-xs text-ink-soft dark:text-stone-400">
                      @{commenter.handle}
                    </span>
                  </div>
                  <p className="font-sans text-[14px] leading-snug text-ink/90 dark:text-stone-200/90">
                    {FAKE_COMMENTS[i % FAKE_COMMENTS.length]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-ink/10 px-4 py-3 dark:border-white/10">
          <MiniAvatar name="You" color="#8a8378" size={28} />
          <div className="flex-1 rounded-full bg-ink/5 px-3.5 py-2 font-sans text-sm text-ink-soft dark:bg-white/5 dark:text-stone-400">
            Add a comment…
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tags — redesigned from filled pills to understated underlined inline text,
// single line, with a "+N" overflow indicator. Reuses the same
// show-first-N-then-fold heuristic as the original AuthorMeta rather than
// precise width measurement.
// ---------------------------------------------------------------------------

function TagsInline({ tags }: { tags: string[] }) {
  const VISIBLE = 3
  const shown = tags.slice(0, VISIBLE)
  const hiddenCount = tags.length - shown.length
  return (
    <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-x-2.5 overflow-hidden whitespace-nowrap font-sans text-[12px] text-ink-soft dark:text-stone-400">
      {shown.map((tag) => (
        <span key={tag} className="underline decoration-ink/30 underline-offset-2 dark:decoration-white/30">
          {tag}
        </span>
      ))}
      {hiddenCount > 0 && <span className="shrink-0">+{hiddenCount}</span>}
    </div>
  )
}

/** Subtitle line: "Chapter N of ? in <work>" — only for chaptered longform/drabble items. */
function ChapterContext({ chapter }: { chapter: NonNullable<DrabbleItem['chapter']> }) {
  return (
    <p className="font-sans text-[12.5px] text-ink-soft dark:text-stone-400">
      Chapter {chapter.current} of {chapter.total ?? '?'} in{' '}
      <span className="italic">{chapter.work}</span>
    </p>
  )
}

// ---------------------------------------------------------------------------
// Per-item "played" tracking via IntersectionObserver — unchanged mechanics.
// ---------------------------------------------------------------------------

/** Reveals `true` the first time the element crosses `threshold`, and stays true forever after. */
function useInViewOnce(threshold = 0.6) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [played, setPlayed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || played) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setPlayed(true)
            observer.disconnect()
          }
        }
      },
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ref, played }
}

// ---------------------------------------------------------------------------
// Text reveal ("typed out") — staggered per-word opacity/translate reveal.
// Unchanged mechanics, restyled colors happen at the call site.
// ---------------------------------------------------------------------------

function TypedText({
  text,
  play,
  className,
  totalMs = 600,
}: {
  text: string
  play: boolean
  className?: string
  totalMs?: number
}) {
  const words = text.split(' ')
  const step = Math.min(28, totalMs / Math.max(words.length, 1))
  return (
    <p className={className}>
      {words.map((w, i) => (
        <span
          key={i}
          className="inline-block transition-all ease-out"
          style={{
            transitionDuration: '260ms',
            transitionDelay: `${i * step}ms`,
            opacity: play ? 1 : 0,
            transform: play ? 'translateY(0)' : 'translateY(6px)',
          }}
        >
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Chat bubble reveal — sequential stagger with a brief typing indicator.
// Unchanged mechanics, restyled to the paper-card look at the call site.
// ---------------------------------------------------------------------------

function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-ink/10 px-3 py-2.5 dark:bg-white/10">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/60 dark:bg-white/70"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: '900ms' }}
        />
      ))}
    </div>
  )
}

function ChatBubbles({
  messages,
  participants,
  play,
  instant = false,
}: {
  messages: ChatItem['messages']
  participants: ChatItem['participants']
  play: boolean
  /** Skip the typing-indicator stagger and show every bubble right away — used for carousel slides after the first. */
  instant?: boolean
}) {
  const STAGGER = 320
  const TYPING_LEAD = 220
  const [visibleCount, setVisibleCount] = useState(instant ? messages.length : 0)
  const [typingIndex, setTypingIndex] = useState<number | null>(null)

  useEffect(() => {
    if (instant) {
      setVisibleCount(messages.length)
      return
    }
    if (!play) return
    const timers: ReturnType<typeof setTimeout>[] = []
    messages.forEach((_, i) => {
      timers.push(setTimeout(() => setTypingIndex(i), i * STAGGER))
      timers.push(
        setTimeout(() => {
          setTypingIndex((cur) => (cur === i ? null : cur))
          setVisibleCount((c) => Math.max(c, i + 1))
        }, i * STAGGER + TYPING_LEAD),
      )
    })
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, instant])

  return (
    <div className="flex flex-col gap-2.5">
      {messages.map((m, i) => {
        const isRight = m.speaker === 'b'
        const person = participants[m.speaker]
        const shown = i < visibleCount
        const typing = typingIndex === i
        return (
          <div key={i} className={cn('flex w-full', isRight ? 'justify-end' : 'justify-start')}>
            {typing ? (
              <TypingDots />
            ) : (
              <div
                className="max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug text-white shadow-sm transition-all duration-300 ease-out"
                style={{
                  backgroundColor: person.color,
                  opacity: shown ? 1 : 0,
                  transform: shown
                    ? 'translateX(0) scale(1)'
                    : `translateX(${isRight ? 16 : -16}px) scale(0.94)`,
                }}
              >
                {m.text}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Carousel paging gesture — identical mechanics to reels-feed.tsx (axis-lock,
// rubber-band resistance, drag-follows-thumb, commit-on-threshold). Only the
// visual result (pagerTrackStyle + peek card) changes at the call site.
// ---------------------------------------------------------------------------

const RUBBER_BAND_FACTOR = 0.35
const COMMIT_FRACTION = 0.35
const AXIS_LOCK_THRESHOLD = 8

function useHorizontalPager(count: number) {
  const [index, setIndex] = useState(0)
  const [dragPx, setDragPx] = useState(0)
  const [settling, setSettling] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const widthRef = useRef(1)
  const axisRef = useRef<'horizontal' | 'vertical' | null>(null)
  const elRef = useRef<HTMLDivElement | null>(null)
  const indexRef = useRef(index)
  indexRef.current = index
  const countRef = useRef(count)
  countRef.current = count

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
    widthRef.current = e.currentTarget.getBoundingClientRect().width || 1
    axisRef.current = null
    setSettling(false)
  }

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const handleTouchMove = (e: TouchEvent) => {
      if (!start.current) return
      const t = e.touches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y

      if (axisRef.current === null) {
        if (Math.abs(dx) < AXIS_LOCK_THRESHOLD && Math.abs(dy) < AXIS_LOCK_THRESHOLD) return
        axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      }

      if (axisRef.current === 'vertical') return

      e.preventDefault()
      const idx = indexRef.current
      const cnt = countRef.current
      let next = dx
      if ((idx === 0 && dx > 0) || (idx === cnt - 1 && dx < 0)) {
        next = dx * (1 - RUBBER_BAND_FACTOR)
      }
      setDragPx(next)
    }

    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', handleTouchMove)
  }, [])

  const onTouchEnd = () => {
    if (!start.current) return
    start.current = null
    const wasHorizontal = axisRef.current === 'horizontal'
    axisRef.current = null
    if (!wasHorizontal) {
      setDragPx(0)
      return
    }
    const width = widthRef.current
    const commitThreshold = width * COMMIT_FRACTION
    setSettling(true)
    if (dragPx <= -commitThreshold && index < count - 1) {
      setIndex((i) => Math.min(i + 1, Math.max(count - 1, 0)))
    } else if (dragPx >= commitThreshold && index > 0) {
      setIndex((i) => Math.max(i - 1, 0))
    }
    setDragPx(0)
  }

  return { index, setIndex, dragPx, settling, onTouchStart, onTouchEnd, elRef }
}

type HorizontalPager = ReturnType<typeof useHorizontalPager>

/** translateX (as a CSS value) + transition for a pager-driven slide track. */
function pagerTrackStyle(pager: HorizontalPager): React.CSSProperties {
  return {
    transform: `translateX(calc(-${pager.index * 100}% + ${pager.dragPx}px))`,
    transition: pager.settling ? 'transform 300ms ease-out' : 'none',
  }
}

/** "Read [full title]" pill — only shown on the last slide of an item long enough to warrant it. */
function ReadMorePill({ label, onClick, visible }: { label: string; onClick: () => void; visible: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'pointer-events-auto mt-1 w-fit rounded-full bg-ink px-4 py-2 font-sans text-sm font-semibold text-paper shadow-md transition-all duration-500 dark:bg-white dark:text-ink',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
      style={{ transitionDelay: visible ? '400ms' : '0ms' }}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Carousel slide-splitting — chunks a drabble/longform's text into 2-3
// sequential slides, or a chat's message list into slides of ~2 messages.
// Unchanged mechanics from reels-feed.tsx.
// ---------------------------------------------------------------------------

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s+|$)/g)
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [text]
}

function chunkText(text: string, maxSlides = 3): string[] {
  const sentences = splitSentences(text)
  if (sentences.length <= 2) return [text]
  const slideCount = Math.min(maxSlides, Math.ceil(sentences.length / 2))
  const perSlide = Math.ceil(sentences.length / slideCount)
  const slides: string[] = []
  for (let i = 0; i < sentences.length; i += perSlide) {
    slides.push(sentences.slice(i, i + perSlide).join(' '))
  }
  return slides
}

function chunkMessages(messages: ChatItem['messages'], perSlide = 2): ChatItem['messages'][] {
  if (messages.length <= perSlide) return [messages]
  const slides: ChatItem['messages'][] = []
  for (let i = 0; i < messages.length; i += perSlide) {
    slides.push(messages.slice(i, i + perSlide))
  }
  return slides
}

// ---------------------------------------------------------------------------
// Slide-in full-story reader panel — same lifecycle/gesture as reels-feed.tsx,
// restyled to the light/dark paper theme.
// ---------------------------------------------------------------------------

function ReaderPanel({
  open,
  onClose,
  title,
  author,
  paragraphs,
}: {
  open: boolean
  onClose: () => void
  title: string
  author: Author
  paragraphs: string[]
}) {
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    const timer = window.setTimeout(() => setMounted(false), 300)
    return () => window.clearTimeout(timer)
  }, [open])

  const startRef = useRef<{ x: number; y: number } | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!startRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - startRef.current.x
    const dy = t.clientY - startRef.current.y
    startRef.current = null
    if (dx > 90 && Math.abs(dx) > Math.abs(dy)) {
      onClose()
    }
  }

  if (!mounted) return null
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-paper text-ink transition-transform duration-300 ease-out dark:bg-night dark:text-stone-200"
      style={{ transform: shown ? 'translateX(0)' : 'translateX(100%)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center gap-3 border-b border-ink/10 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] dark:border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Back to feed"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="truncate font-serif text-base font-semibold">{title}</div>
          <div className="font-sans text-xs text-ink-soft dark:text-stone-400">@{author.handle}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="font-serif text-lg leading-relaxed text-ink/90 dark:text-stone-200/90">
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Slide-in author profile panel — same pattern/transition as ReaderPanel,
// restyled to the light/dark paper theme.
// ---------------------------------------------------------------------------

const FAKE_BIOS = [
  "writes too fast, edits too slow. always taking requests.",
  'professional overthinker. fic is just organized crying.',
  'college au enthusiast, slow burn apologist.',
  'here for the pining. always here for the pining.',
  "unbeta'd and proud of it.",
]

const FAKE_WORK_TITLES = ['Static Bloom', 'Borrowed Time', 'Paper Lanterns', 'The Quiet Hour', 'Nothing But the Radio']

function worksFor(author: Author): { title: string; type: FeedItem['type']; likes: number }[] {
  const all = [...FEED, ...FOLLOWING]
  const own = all
    .filter((i) => i.author.handle === author.handle)
    .map((i) => ({ title: i.title, type: i.type, likes: i.likes }))
  if (own.length >= 3) return own.slice(0, 5)
  const types: FeedItem['type'][] = ['drabble', 'longform', 'chat']
  const padding = FAKE_WORK_TITLES.slice(0, 5 - own.length).map((title, i) => ({
    title,
    type: types[i % types.length],
    likes: 120 + i * 87,
  }))
  return [...own, ...padding]
}

function ProfilePanel({ open, onClose, author }: { open: boolean; onClose: () => void; author: Author | null }) {
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    const timer = window.setTimeout(() => setMounted(false), 300)
    return () => window.clearTimeout(timer)
  }, [open])

  const startRef = useRef<{ x: number; y: number } | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!startRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - startRef.current.x
    const dy = t.clientY - startRef.current.y
    startRef.current = null
    if (dx > 90 && Math.abs(dx) > Math.abs(dy)) {
      onClose()
    }
  }

  if (!mounted || !author) return null
  const bio = FAKE_BIOS[author.handle.length % FAKE_BIOS.length]
  const works = worksFor(author)
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-paper text-ink transition-transform duration-300 ease-out dark:bg-night dark:text-stone-200"
      style={{ transform: shown ? 'translateX(0)' : 'translateX(100%)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center gap-3 border-b border-ink/10 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] dark:border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Back to feed"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-sans text-sm font-semibold">Profile</span>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="flex items-center gap-4">
            <MiniAvatar name={author.name} color={author.color} size={72} />
            <div>
              <div className="font-serif text-xl font-semibold">{author.name}</div>
              <div className="font-sans text-sm text-ink-soft dark:text-stone-400">@{author.handle}</div>
            </div>
          </div>
          <p className="font-sans text-sm leading-relaxed text-ink/80 dark:text-stone-300">{bio}</p>
          <div className="flex flex-col gap-3">
            <span className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-stone-400">
              Works
            </span>
            {works.map((w, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl bg-ink/[0.03] px-3.5 py-3 dark:bg-white/5"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-serif text-[15px]">{w.title}</span>
                  <span className="font-sans text-[11px] uppercase tracking-wide text-ink-soft dark:text-stone-400">
                    {w.type}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-ink-soft dark:text-stone-400">
                  <Heart className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span className="font-sans text-xs">{fmtCount(w.likes)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const LOREM_EXTRA = [
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
  'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.',
  'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.',
]

const OMEGA_EXTRA = [
  'The hallway outside the practice room was always colder than the rest of the building, like the company saved its heating budget for anywhere a camera might be. Jaehyun didn\'t mind. It meant fewer people lingered, and lately fewer people lingering was exactly what he wanted.',
  'Minhyuk found him there a little after midnight, sitting against the wall with his knees drawn up, phone dark in his lap. He didn\'t ask what was wrong. He just sat down close enough that their shoulders touched, and waited, the way he always did, for Jaehyun to decide when he was ready to talk.',
  '"You\'re going to say it\'s nothing," Minhyuk said eventually, not quite a question.\n"It\'s nothing," Jaehyun said, and then, because Minhyuk kept waiting anyway: "I keep thinking about how many people are going to hear this song and think they know us."\nMinhyuk considered that for a moment. "Let them think what they want. I know the difference."',
]

/** Builds the reader's extended paragraphs for a feed item from its existing card text. */
function readerParagraphsFor(item: FeedItem, isFollowing: boolean): string[] {
  const extra = isFollowing ? OMEGA_EXTRA : LOREM_EXTRA
  if (item.type === 'drabble') return [item.text, ...extra.slice(0, 2)]
  if (item.type === 'longform') return [item.intro, ...extra]
  return [
    `A longer look inside "${item.title}": ${item.messages.map((m) => m.text).join(' ')}`,
    ...extra.slice(0, 2),
  ]
}

// ---------------------------------------------------------------------------
// New: simulated live comments. After the caption reveal completes, 2-3 short
// fake comments animate in one at a time, each pushing earlier ones up via a
// height/opacity transition rather than an abrupt layout jump. Capped at 3 so
// it never grows past a small fixed footprint within the slide's viewport.
// ---------------------------------------------------------------------------

function useSimulatedComments(active: boolean, seed: number) {
  const [shownCount, setShownCount] = useState(0)
  const pool = useMemo(() => {
    const start = seed % LIVE_COMMENTS.length
    return [0, 1, 2].map((i) => LIVE_COMMENTS[(start + i) % LIVE_COMMENTS.length])
  }, [seed])

  useEffect(() => {
    if (!active) return
    const timers = pool.map((_, i) =>
      setTimeout(() => setShownCount((c) => Math.max(c, i + 1)), i * 700),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return pool.slice(0, shownCount)
}

function LiveComments({ comments }: { comments: string[] }) {
  if (comments.length === 0) return null
  return (
    <div className="flex flex-col gap-1 overflow-hidden">
      {comments.map((c, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 font-sans text-[12.5px] text-ink-soft transition-all duration-400 ease-out dark:text-stone-400"
          style={{
            animation: 'v2-comment-in 400ms ease-out both',
          }}
        >
          <span className="h-1 w-1 shrink-0 rounded-full bg-ink/30 dark:bg-white/30" />
          <span className="truncate">{c}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Author row — redesigned to a single line: avatar + name + caption together,
// truncating with ellipsis rather than stacking across separate lines.
// ---------------------------------------------------------------------------

function AuthorLine({
  author,
  note,
  captionVisible,
  onAvatarClick,
}: {
  author: Author
  note?: string
  captionVisible: boolean
  onAvatarClick?: () => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onAvatarClick?.()
        }}
        className="shrink-0 rounded-full transition-transform active:scale-90"
        aria-label={`View ${author.name}'s profile`}
      >
        <MiniAvatar name={author.name} color={author.color} size={26} />
      </button>
      <p className="min-w-0 flex-1 truncate font-sans text-[13px]">
        <span className="font-semibold text-ink dark:text-stone-100">{author.name}</span>
        {note && (
          <span
            className="text-ink-soft transition-all duration-300 ease-out dark:text-stone-400"
            style={{
              opacity: captionVisible ? 1 : 0,
              transform: captionVisible ? 'translateX(0)' : 'translateX(-4px)',
            }}
          >
            {' '}
            · {note}
          </span>
        )}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline actions row — share / bookmark / comment(+count) / heart(+count),
// rendered near the author row instead of a floating vertical rail.
// ---------------------------------------------------------------------------

function ActionsInline({
  likes,
  comments,
  liked,
  onToggleLike,
  onOpenComments,
}: {
  likes: number
  comments: number
  liked: boolean
  onToggleLike: () => void
  onOpenComments: () => void
}) {
  return (
    <div className="flex items-center gap-4 text-ink-soft dark:text-stone-400">
      <button
        type="button"
        onClick={() => console.log('share tapped (inert)')}
        className="transition-transform active:scale-90"
        aria-label="Share"
      >
        <Share2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => console.log('save tapped (inert)')}
        className="transition-transform active:scale-90"
        aria-label="Save"
      >
        <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={onOpenComments}
        className="flex items-center gap-1 transition-transform active:scale-90"
      >
        <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
        <span className="font-sans text-xs font-medium">{fmtCount(comments)}</span>
      </button>
      <button
        type="button"
        onClick={onToggleLike}
        className="flex items-center gap-1 transition-transform active:scale-90"
      >
        <Heart
          className={cn('h-[18px] w-[18px]', liked && 'fill-rose-500 text-rose-500')}
          strokeWidth={1.75}
        />
        <span className="font-sans text-xs font-medium">{fmtCount(liked ? likes + 1 : likes)}</span>
      </button>
    </div>
  )
}

/** Decorative, non-functional comment input — purely visual, doesn't submit anything. */
function CommentInputDecoy() {
  return (
    <input
      type="text"
      placeholder="comment..."
      readOnly
      className="w-full rounded-full bg-ink/[0.04] px-3.5 py-2 font-sans text-[13px] text-ink placeholder:text-ink-soft focus:outline-none dark:bg-white/5 dark:text-stone-200 dark:placeholder:text-stone-500"
      onClick={(e) => e.preventDefault()}
    />
  )
}

// ---------------------------------------------------------------------------
// Next-slide "peek" — replaces the dot pagination entirely. Shows a sliver of
// the next carousel slide's card at the right edge as the primary affordance
// that there's more to swipe. Rendered as a scaled/offset ghost of the card
// that only appears when a next slide exists, and tracks the live drag so it
// gets pulled into view as the user drags.
// ---------------------------------------------------------------------------

const PEEK_WIDTH = 28

function NextSlidePeek({
  hasNext,
  dragPx,
  accent,
  children,
}: {
  hasNext: boolean
  dragPx: number
  accent: string
  children: React.ReactNode
}) {
  if (!hasNext) return null
  // Pull the peek further into view as the user drags left (negative dragPx).
  const pull = Math.max(0, -dragPx)
  return (
    <div
      className="pointer-events-none absolute inset-y-3 z-10 overflow-hidden rounded-2xl border border-ink/10 bg-paper opacity-90 shadow-sm dark:border-white/10 dark:bg-surface-night"
      style={{
        right: -PEEK_WIDTH - pull * 0.5,
        width: PEEK_WIDTH + 40,
      }}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />
      <div className="p-3 opacity-60">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The three card types
// ---------------------------------------------------------------------------

/** Shared like + comment-sheet state for a feed item. */
function useCardEngagement() {
  const [liked, setLiked] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const toggleLike = () => setLiked((v) => !v)
  const likeOnDoubleTap = () => setLiked(true)
  return { liked, toggleLike, likeOnDoubleTap, commentsOpen, setCommentsOpen }
}

/** Header block above the content card: title, optional chapter context, tags. */
function CardHeader({
  title,
  chapter,
  tags,
}: {
  title: string
  chapter?: DrabbleItem['chapter']
  tags: string[]
}) {
  return (
    <div className="mb-3 flex flex-col gap-1.5 px-1">
      <h2 className="font-serif text-2xl font-bold leading-tight text-ink dark:text-stone-50">{title}</h2>
      {chapter && <ChapterContext chapter={chapter} />}
      <TagsInline tags={tags} />
    </div>
  )
}

/**
 * Below-card block: author line, decorative comment input OR simulated live
 * comments (they share one visual slot so the input never gets shoved
 * off-screen by the growing comment list), and the inline actions row.
 */
function CardFooter({
  author,
  note,
  likes,
  comments,
  liked,
  toggleLike,
  onOpenComments,
  onOpenProfile,
  captionVisible,
  liveComments,
}: {
  author: Author
  note?: string
  likes: number
  comments: number
  liked: boolean
  toggleLike: () => void
  onOpenComments: () => void
  onOpenProfile: () => void
  captionVisible: boolean
  liveComments: string[]
}) {
  return (
    <div className="mt-3 flex flex-col gap-2 px-1">
      <AuthorLine author={author} note={note} captionVisible={captionVisible} onAvatarClick={onOpenProfile} />
      <div className="min-h-[1.25rem]">
        {liveComments.length > 0 ? <LiveComments comments={liveComments} /> : <CommentInputDecoy />}
      </div>
      <ActionsInline
        likes={likes}
        comments={comments}
        liked={liked}
        onToggleLike={toggleLike}
        onOpenComments={onOpenComments}
      />
    </div>
  )
}

/** Wraps the content card with the new entrance animation (fade + slight scale/slide-up on first view). */
function CardEntrance({ played, children }: { played: boolean; children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-ink/10 bg-paper px-5 py-8 shadow-md transition-all duration-[380ms] ease-out dark:border-white/10 dark:bg-surface-night sm:px-8"
      style={{
        opacity: played ? 1 : 0,
        transform: played ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
      }}
    >
      {children}
    </div>
  )
}

function DrabbleCard({
  item,
  isFollowing,
  onOpenProfile,
}: {
  item: DrabbleItem
  isFollowing: boolean
  onOpenProfile: (author: Author) => void
}) {
  const { ref, played } = useInViewOnce()
  const { liked, toggleLike, likeOnDoubleTap, commentsOpen, setCommentsOpen } = useCardEngagement()
  const [readerOpen, setReaderOpen] = useState(false)
  const slides = useMemo(() => chunkText(item.text), [item.text])
  const pager = useHorizontalPager(slides.length)
  const showReadMore = slides.length >= 3
  const isLastSlide = pager.index === slides.length - 1
  const [captionVisible, setCaptionVisible] = useState(false)
  const liveComments = useSimulatedComments(captionVisible, item.title.length)

  useEffect(() => {
    if (!played) return
    const t = window.setTimeout(() => setCaptionVisible(true), 550)
    return () => window.clearTimeout(t)
  }, [played])

  return (
    <div
      ref={(node) => {
        ref.current = node
        pager.elRef.current = node
      }}
      className="relative flex h-full w-full flex-col justify-center bg-surface px-4 py-16 dark:bg-night sm:px-8"
      onTouchStart={pager.onTouchStart}
      onTouchEnd={pager.onTouchEnd}
    >
      <div className="relative mx-auto w-full max-w-md">
        <CardHeader title={item.title} chapter={item.chapter} tags={item.tags} />
        <CardEntrance played={played}>
          <DoubleTapLike onDoubleTap={likeOnDoubleTap}>
            <div className="relative overflow-hidden">
              <div className="flex" style={pagerTrackStyle(pager)}>
                {slides.map((slide, i) =>
                  i === 0 ? (
                    <div key={i} className="w-full shrink-0">
                      <TypedText
                        text={slide}
                        play={played}
                        className="font-serif text-lg leading-relaxed text-ink dark:text-stone-200"
                        totalMs={550}
                      />
                    </div>
                  ) : (
                    <p
                      key={i}
                      className="w-full shrink-0 font-serif text-lg leading-relaxed text-ink transition-opacity duration-300 dark:text-stone-200"
                    >
                      {slide}
                    </p>
                  ),
                )}
              </div>
              <NextSlidePeek hasNext={pager.index < slides.length - 1} dragPx={pager.dragPx} accent={item.author.color}>
                <p className="font-serif text-sm leading-snug text-ink dark:text-stone-300">
                  {slides[pager.index + 1]}
                </p>
              </NextSlidePeek>
            </div>
          </DoubleTapLike>
          {showReadMore && isLastSlide && (
            <div className="mt-3">
              <ReadMorePill label={`Read "${item.title}"`} onClick={() => setReaderOpen(true)} visible={played} />
            </div>
          )}
        </CardEntrance>
        <CardFooter
          author={item.author}
          note={item.note}
          likes={item.likes}
          comments={item.comments}
          liked={liked}
          toggleLike={toggleLike}
          onOpenComments={() => setCommentsOpen(true)}
          onOpenProfile={() => onOpenProfile(item.author)}
          captionVisible={captionVisible}
          liveComments={liveComments}
        />
      </div>
      <CommentSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} count={item.comments} />
      <ReaderPanel
        open={readerOpen}
        onClose={() => setReaderOpen(false)}
        title={item.title}
        author={item.author}
        paragraphs={readerParagraphsFor(item, isFollowing)}
      />
    </div>
  )
}

function LongformCard({
  item,
  isFollowing,
  onOpenProfile,
}: {
  item: LongformItem
  isFollowing: boolean
  onOpenProfile: (author: Author) => void
}) {
  const { ref, played } = useInViewOnce()
  const { liked, toggleLike, likeOnDoubleTap, commentsOpen, setCommentsOpen } = useCardEngagement()
  const [readerOpen, setReaderOpen] = useState(false)
  const slides = useMemo(() => chunkText(item.intro), [item.intro])
  const pager = useHorizontalPager(slides.length)
  const isLastSlide = pager.index === slides.length - 1
  const [captionVisible, setCaptionVisible] = useState(false)
  const liveComments = useSimulatedComments(captionVisible, item.title.length)

  useEffect(() => {
    if (!played) return
    const t = window.setTimeout(() => setCaptionVisible(true), 650)
    return () => window.clearTimeout(t)
  }, [played])

  return (
    <div
      ref={(node) => {
        ref.current = node
        pager.elRef.current = node
      }}
      className="relative flex h-full w-full flex-col justify-center bg-surface px-4 py-16 dark:bg-night sm:px-8"
      onTouchStart={pager.onTouchStart}
      onTouchEnd={pager.onTouchEnd}
    >
      <div className="relative mx-auto w-full max-w-md">
        <CardHeader title={item.title} chapter={item.chapter} tags={item.tags} />
        <CardEntrance played={played}>
          <DoubleTapLike onDoubleTap={likeOnDoubleTap}>
            <div className="relative overflow-hidden">
              <div className="flex" style={pagerTrackStyle(pager)}>
                {slides.map((slide, i) =>
                  i === 0 ? (
                    <div key={i} className="w-full shrink-0">
                      <TypedText
                        text={slide}
                        play={played}
                        className="font-serif text-lg leading-relaxed text-ink dark:text-stone-200"
                        totalMs={700}
                      />
                    </div>
                  ) : (
                    <p
                      key={i}
                      className="w-full shrink-0 font-serif text-lg leading-relaxed text-ink transition-opacity duration-300 dark:text-stone-200"
                    >
                      {slide}
                    </p>
                  ),
                )}
              </div>
              <NextSlidePeek hasNext={pager.index < slides.length - 1} dragPx={pager.dragPx} accent={item.author.color}>
                <p className="font-serif text-sm leading-snug text-ink dark:text-stone-300">
                  {slides[pager.index + 1]}
                </p>
              </NextSlidePeek>
            </div>
          </DoubleTapLike>
          {isLastSlide && (
            <div className="mt-3">
              <ReadMorePill label={`Read "${item.title}"`} onClick={() => setReaderOpen(true)} visible={played} />
            </div>
          )}
        </CardEntrance>
        <CardFooter
          author={item.author}
          note={item.note}
          likes={item.likes}
          comments={item.comments}
          liked={liked}
          toggleLike={toggleLike}
          onOpenComments={() => setCommentsOpen(true)}
          onOpenProfile={() => onOpenProfile(item.author)}
          captionVisible={captionVisible}
          liveComments={liveComments}
        />
      </div>
      <CommentSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} count={item.comments} />
      <ReaderPanel
        open={readerOpen}
        onClose={() => setReaderOpen(false)}
        title={item.title}
        author={item.author}
        paragraphs={readerParagraphsFor(item, isFollowing)}
      />
    </div>
  )
}

function ChatCard({
  item,
  isFollowing,
  onOpenProfile,
}: {
  item: ChatItem
  isFollowing: boolean
  onOpenProfile: (author: Author) => void
}) {
  const { ref, played } = useInViewOnce()
  const { liked, toggleLike, likeOnDoubleTap, commentsOpen, setCommentsOpen } = useCardEngagement()
  const [readerOpen, setReaderOpen] = useState(false)
  const slides = useMemo(() => chunkMessages(item.messages), [item.messages])
  const pager = useHorizontalPager(slides.length)
  const showReadMore = slides.length >= 3
  const isLastSlide = pager.index === slides.length - 1
  const [captionVisible, setCaptionVisible] = useState(false)
  const liveComments = useSimulatedComments(captionVisible, item.title.length)

  // Chat bubbles take longer to finish revealing than typed text; delay the
  // caption reveal roughly past when the last bubble should have appeared.
  useEffect(() => {
    if (!played) return
    const revealMs = 320 * Math.min(slides[0]?.length ?? 0, 6) + 400
    const t = window.setTimeout(() => setCaptionVisible(true), revealMs)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played])

  return (
    <div
      ref={(node) => {
        ref.current = node
        pager.elRef.current = node
      }}
      className="relative flex h-full w-full flex-col justify-center bg-surface px-4 py-16 dark:bg-night sm:px-8"
      onTouchStart={pager.onTouchStart}
      onTouchEnd={pager.onTouchEnd}
    >
      <div className="relative mx-auto w-full max-w-md">
        <CardHeader title={item.title} tags={item.tags} />
        <CardEntrance played={played}>
          <DoubleTapLike onDoubleTap={likeOnDoubleTap}>
            <div className="relative overflow-hidden">
              <div className="flex" style={pagerTrackStyle(pager)}>
                {slides.map((slideMessages, i) => (
                  <div key={i} className="w-full shrink-0 transition-opacity duration-300">
                    <ChatBubbles
                      messages={slideMessages}
                      participants={item.participants}
                      play={i === 0 && played}
                      instant={i > 0}
                    />
                  </div>
                ))}
              </div>
              <NextSlidePeek hasNext={pager.index < slides.length - 1} dragPx={pager.dragPx} accent={item.author.color}>
                <div className="scale-90">
                  <ChatBubbles
                    messages={(slides[pager.index + 1] ?? []).slice(0, 1)}
                    participants={item.participants}
                    play
                    instant
                  />
                </div>
              </NextSlidePeek>
            </div>
          </DoubleTapLike>
          {showReadMore && isLastSlide && (
            <div className="mt-3">
              <ReadMorePill label={`Read "${item.title}"`} onClick={() => setReaderOpen(true)} visible={played} />
            </div>
          )}
        </CardEntrance>
        <CardFooter
          author={item.author}
          note={item.note}
          likes={item.likes}
          comments={item.comments}
          liked={liked}
          toggleLike={toggleLike}
          onOpenComments={() => setCommentsOpen(true)}
          onOpenProfile={() => onOpenProfile(item.author)}
          captionVisible={captionVisible}
          liveComments={liveComments}
        />
      </div>
      <CommentSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} count={item.comments} />
      <ReaderPanel
        open={readerOpen}
        onClose={() => setReaderOpen(false)}
        title={item.title}
        author={item.author}
        paragraphs={readerParagraphsFor(item, isFollowing)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type FeedTab = 'forYou' | 'following'
type ActiveView = 'discover' | 'search' | 'write' | 'library' | 'notifications'

function FeedTabs({ tab, onChange }: { tab: FeedTab; onChange: (tab: FeedTab) => void }) {
  return (
    <div
      className="pointer-events-auto absolute left-1/2 z-30 -translate-x-1/2"
      style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <div className="flex items-center gap-1 rounded-full border border-ink/10 bg-paper/90 p-1 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-surface-night/90">
        {(
          [
            { key: 'forYou', label: 'For You' },
            { key: 'following', label: 'Following' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              'rounded-full px-4 py-1.5 font-sans text-sm font-semibold tracking-wide transition-colors',
              tab === opt.key
                ? 'bg-ink text-paper dark:bg-white dark:text-ink'
                : 'text-ink-soft hover:text-ink dark:text-stone-400 dark:hover:text-white',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bottom tab bar — same tab set + fake-mock-screen behavior as reels-feed.tsx,
// restyled to the light theme. "Write" stays a filled-circle CTA but flush at
// the same height as the rest of the row (no raised/elevated -mt offset).
// ---------------------------------------------------------------------------

function PlaygroundTabBar({
  active,
  onChange,
}: {
  active: ActiveView
  onChange: (view: ActiveView) => void
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[env(safe-area-inset-bottom)]"
      aria-label="Playground navigation"
    >
      <div className="pointer-events-auto relative flex w-full max-w-md items-center justify-between border-t border-ink/10 bg-paper/95 px-4 py-2.5 backdrop-blur-md dark:border-white/10 dark:bg-surface-night/95">
        {/* Discover */}
        <button
          type="button"
          onClick={() => onChange('discover')}
          className={cn(
            'flex flex-col items-center gap-0.5 px-2 py-1 transition-colors',
            active === 'discover' ? 'text-ink dark:text-white' : 'text-ink-soft hover:text-ink dark:text-stone-500 dark:hover:text-stone-200',
          )}
        >
          <Compass className="h-5 w-5" strokeWidth={active === 'discover' ? 2 : 1.75} />
          <span className="font-sans text-[10px] font-medium">Discover</span>
        </button>

        {/* Search */}
        <button
          type="button"
          onClick={() => onChange('search')}
          className={cn(
            'flex flex-col items-center gap-0.5 px-2 py-1 transition-colors',
            active === 'search' ? 'text-ink dark:text-white' : 'text-ink-soft hover:text-ink dark:text-stone-500 dark:hover:text-stone-200',
          )}
        >
          <Search className="h-5 w-5" strokeWidth={active === 'search' ? 2 : 1.75} />
          <span className="font-sans text-[10px] font-medium">Search</span>
        </button>

        {/* Write — filled circular CTA, flush with the rest of the row */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => onChange('write')}
            aria-label="Write"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-paper shadow-sm transition-transform active:scale-90 dark:bg-white dark:text-ink"
          >
            <PenLine className="h-4 w-4" strokeWidth={2} />
          </button>
          <span className="mt-0.5 font-sans text-[10px] font-medium text-ink-soft dark:text-stone-500">Write</span>
        </div>

        {/* Library */}
        <button
          type="button"
          onClick={() => onChange('library')}
          className={cn(
            'flex flex-col items-center gap-0.5 px-2 py-1 transition-colors',
            active === 'library' ? 'text-ink dark:text-white' : 'text-ink-soft hover:text-ink dark:text-stone-500 dark:hover:text-stone-200',
          )}
        >
          <Library className="h-5 w-5" strokeWidth={active === 'library' ? 2 : 1.75} />
          <span className="font-sans text-[10px] font-medium">Library</span>
        </button>

        {/* Notifications */}
        <button
          type="button"
          onClick={() => onChange('notifications')}
          className={cn(
            'flex flex-col items-center gap-0.5 px-2 py-1 transition-colors',
            active === 'notifications' ? 'text-ink dark:text-white' : 'text-ink-soft hover:text-ink dark:text-stone-500 dark:hover:text-stone-200',
          )}
        >
          <Bell className="h-5 w-5" strokeWidth={active === 'notifications' ? 2 : 1.75} />
          <span className="font-sans text-[10px] font-medium">Notifications</span>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fake static mock screens for the non-Discover tabs — restyled to the
// light/dark paper theme. Same behavior/layout as reels-feed.tsx.
// ---------------------------------------------------------------------------

function MockScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-ink/10 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] dark:border-white/10">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white"
        aria-label="Back to feed"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="font-sans text-sm font-semibold">{title}</span>
    </div>
  )
}

function SearchMock({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <MockScreenHeader title="Search" onBack={onBack} />
      <div className="px-4 pt-4">
        <div className="rounded-full bg-ink/5 px-4 py-2.5 font-sans text-sm text-ink-soft dark:bg-white/5 dark:text-stone-500">
          Search stories, authors, tags
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {FAKE_SEARCH_RESULTS.map((r, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-ink/[0.03] px-3.5 py-3 dark:bg-white/5">
              <MiniAvatar name={r.author.name} color={r.author.color} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-[15px]">{r.title}</div>
                <div className="font-sans text-xs text-ink-soft dark:text-stone-400">
                  {r.kind} · @{r.author.handle}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LibraryMock({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <MockScreenHeader title="Library" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <span className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-stone-400">
          Currently reading
        </span>
        <div className="mt-3 flex flex-col gap-3">
          {FAKE_LIBRARY_ITEMS.map((item, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-ink/[0.03] px-3.5 py-3 dark:bg-white/5">
              <MiniAvatar name={item.author.name} color={item.author.color} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-[15px]">{item.title}</div>
                <div className="font-sans text-xs text-ink-soft dark:text-stone-400">@{item.author.handle}</div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                  <div className="h-full rounded-full bg-ink/60 dark:bg-white/70" style={{ width: `${item.progress}%` }} />
                </div>
              </div>
              <span className="shrink-0 font-sans text-xs text-ink-soft dark:text-stone-400">{item.progress}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotificationsMock({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <MockScreenHeader title="Notifications" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {FAKE_NOTIFICATIONS.map((n, i) => (
            <div key={i} className="flex items-center gap-3">
              <MiniAvatar name={n.person.name} color={n.person.color} size={36} />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-sm text-ink/90 dark:text-stone-200">
                  <span className="font-semibold text-ink dark:text-stone-50">{n.person.name}</span> {n.text}
                </p>
              </div>
              <span className="shrink-0 font-sans text-xs text-ink-soft dark:text-stone-500">{n.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WriteMock({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <MockScreenHeader title="Write" onBack={onBack} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        <PenLine className="h-10 w-10 text-ink-soft dark:text-stone-500" strokeWidth={1.5} />
        <div className="w-full max-w-xs rounded-xl bg-ink/[0.03] px-4 py-3 text-left font-serif text-lg text-ink-soft dark:bg-white/5 dark:text-stone-500">
          Untitled story
        </div>
        <button
          type="button"
          onClick={onBack}
          className="w-full max-w-xs rounded-full bg-ink px-6 py-3 font-sans text-sm font-semibold text-paper shadow-md transition-transform active:scale-95 dark:bg-white dark:text-ink"
        >
          Start writing
        </button>
      </div>
    </div>
  )
}

export default function ReelsFeedV2() {
  const [tab, setTab] = useState<FeedTab>('forYou')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const isFollowing = tab === 'following'
  const items = isFollowing ? FOLLOWING : FEED
  const [profileAuthor, setProfileAuthor] = useState<Author | null>(null)
  const [activeView, setActiveView] = useState<ActiveView>('discover')
  const backToDiscover = () => setActiveView('discover')

  const handleTabChange = (next: FeedTab) => {
    setTab(next)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }

  return (
    <div className="fixed inset-0 bg-surface dark:bg-night">
      <style>{`
        @keyframes v2-comment-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <FeedTabs tab={tab} onChange={handleTabChange} />
      <div
        ref={scrollRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-scroll scroll-smooth"
        style={{ height: '100dvh' }}
      >
        {items.map((item) => (
          <section key={item.id} className="relative h-screen w-full snap-start" style={{ height: '100dvh' }}>
            {item.type === 'drabble' && (
              <DrabbleCard item={item} isFollowing={isFollowing} onOpenProfile={setProfileAuthor} />
            )}
            {item.type === 'longform' && (
              <LongformCard item={item} isFollowing={isFollowing} onOpenProfile={setProfileAuthor} />
            )}
            {item.type === 'chat' && (
              <ChatCard item={item} isFollowing={isFollowing} onOpenProfile={setProfileAuthor} />
            )}
          </section>
        ))}
      </div>
      <ProfilePanel open={profileAuthor !== null} onClose={() => setProfileAuthor(null)} author={profileAuthor} />
      {activeView !== 'discover' && (
        <div className="fixed inset-0 z-[35] bg-paper text-ink dark:bg-night dark:text-stone-200">
          {activeView === 'search' && <SearchMock onBack={backToDiscover} />}
          {activeView === 'library' && <LibraryMock onBack={backToDiscover} />}
          {activeView === 'notifications' && <NotificationsMock onBack={backToDiscover} />}
          {activeView === 'write' && <WriteMock onBack={backToDiscover} />}
        </div>
      )}
      <PlaygroundTabBar active={activeView} onChange={setActiveView} />
    </div>
  )
}
