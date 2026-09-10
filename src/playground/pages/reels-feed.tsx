// DESIGN EXPLORATION — TikTok/Reels-style vertical snap feed for the home page.
// Fully self-contained, hardcoded Lorem Ipsum data. Not wired to any real data
// layer, no navigation to real routes. Playground page only — throwaway.
import { useEffect, useRef, useState } from 'react'
import { Heart, MessageCircle, Share2, Bookmark, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Fake data
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

interface DrabbleItem {
  id: string
  type: 'drabble'
  author: Author
  title: string
  text: string
  likes: number
  comments: number
}

interface LongformItem {
  id: string
  type: 'longform'
  author: Author
  title: string
  intro: string
  likes: number
  comments: number
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
  },
  {
    id: 'd2',
    type: 'drabble',
    author: AUTHORS[3],
    title: 'Ninety Seconds',
    text: 'Ut enim ad minim veniam: the elevator stalled between floors, and for ninety seconds they said everything they\'d been too polite to say for ninety days. Quis nostrud exercitation ullamco laboris — then the lights flickered back on, and so did the silence.',
    likes: 356,
    comments: 22,
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
  },
  {
    id: 'd3',
    type: 'drabble',
    author: AUTHORS[1],
    title: 'Inventory',
    text: 'Sed ut perspiciatis unde omnis iste natus error: she kept a list of things she\'d never say out loud, filed alphabetically, updated weekly. Sit voluptatem accusantium doloremque laudantium — under "M" there was only one entry, and it hadn\'t changed in years.',
    likes: 527,
    comments: 40,
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
  },
  {
    id: 'd4',
    type: 'drabble',
    author: AUTHORS[4],
    title: 'Return Policy',
    text: 'Ut enim ad minima veniam, quis nostrum exercitationem ullam: the shop only accepted returns of things that had never truly belonged to you. He\'d been standing in line for three hours with a heart he swore wasn\'t his. Corporis suscipit laboriosam — the clerk just smiled and reached for the ledger.',
    likes: 612,
    comments: 47,
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
  },
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
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white/70"
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

function TypeBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-white/15 px-2.5 py-0.5 font-sans text-[11px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
      {children}
    </span>
  )
}

function ActionRail({
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
    <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-5 text-white sm:right-6">
      <button
        type="button"
        onClick={onToggleLike}
        className="flex flex-col items-center gap-1 transition-transform active:scale-90"
      >
        <Heart
          className={cn('h-7 w-7 drop-shadow', liked && 'fill-rose-500 text-rose-500')}
          strokeWidth={1.75}
        />
        <span className="font-sans text-xs font-medium drop-shadow">
          {fmtCount(liked ? likes + 1 : likes)}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenComments}
        className="flex flex-col items-center gap-1 transition-transform active:scale-90"
      >
        <MessageCircle className="h-7 w-7 drop-shadow" strokeWidth={1.75} />
        <span className="font-sans text-xs font-medium drop-shadow">{fmtCount(comments)}</span>
      </button>
      <button
        type="button"
        onClick={() => console.log('share tapped (inert)')}
        className="flex flex-col items-center gap-1 transition-transform active:scale-90"
      >
        <Share2 className="h-7 w-7 drop-shadow" strokeWidth={1.75} />
        <span className="font-sans text-xs font-medium drop-shadow">Share</span>
      </button>
      <button
        type="button"
        onClick={() => console.log('save tapped (inert)')}
        className="flex flex-col items-center gap-1 transition-transform active:scale-90"
      >
        <Bookmark className="h-7 w-7 drop-shadow" strokeWidth={1.75} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Double-tap-to-like: wraps a card's content, detects two taps within 300ms,
// and fires a big center heart burst — mirrors Instagram/TikTok behavior.
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
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
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
// Purely a visual mock: no input persistence, nothing is actually posted.
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
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          shown ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative z-10 flex max-h-[75vh] flex-col rounded-t-2xl bg-[#141419] pb-[env(safe-area-inset-bottom)] text-white shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: shown ? 'translateY(0)' : 'translateY(100%)' }}
      >
        <div className="flex justify-center pt-2.5">
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <span className="font-sans text-sm font-semibold text-white">
            {fmtCount(count)} comments
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
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
                    <span className="font-sans text-[13px] font-semibold text-white">
                      {commenter.name}
                    </span>
                    <span className="font-sans text-xs text-white/50">@{commenter.handle}</span>
                  </div>
                  <p className="font-sans text-[14px] leading-snug text-white/90">
                    {FAKE_COMMENTS[i % FAKE_COMMENTS.length]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
          <MiniAvatar name="You" color="#6b6b76" size={28} />
          <div className="flex-1 rounded-full bg-white/10 px-3.5 py-2 font-sans text-sm text-white/40">
            Add a comment…
          </div>
        </div>
      </div>
    </div>
  )
}

function AuthorRow({ author }: { author: Author }) {
  return (
    <div className="flex items-center gap-2">
      <MiniAvatar name={author.name} color={author.color} size={36} />
      <div className="leading-tight">
        <div className="font-sans text-sm font-semibold text-white drop-shadow">
          {author.name}
        </div>
        <div className="font-sans text-xs text-white/75 drop-shadow">@{author.handle}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-item "played" tracking via IntersectionObserver
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
// Text reveal ("typed out") — staggered per-word opacity/translate reveal
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
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Chat bubble reveal — sequential stagger with a brief typing indicator
// ---------------------------------------------------------------------------

function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-white/20 px-3 py-2.5 backdrop-blur-sm">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90"
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
}: {
  messages: ChatItem['messages']
  participants: ChatItem['participants']
  play: boolean
}) {
  const STAGGER = 320
  const TYPING_LEAD = 220
  const [visibleCount, setVisibleCount] = useState(0)
  const [typingIndex, setTypingIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!play) return
    const timers: ReturnType<typeof setTimeout>[] = []
    messages.forEach((_, i) => {
      timers.push(
        setTimeout(() => setTypingIndex(i), i * STAGGER),
      )
      timers.push(
        setTimeout(() => {
          setTypingIndex((cur) => (cur === i ? null : cur))
          setVisibleCount((c) => Math.max(c, i + 1))
        }, i * STAGGER + TYPING_LEAD),
      )
    })
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play])

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
                className="max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug text-white shadow-lg transition-all duration-300 ease-out"
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
// The three card types
// ---------------------------------------------------------------------------

function CardChrome({
  children,
  bg,
  author,
  badge,
}: {
  children: React.ReactNode
  bg: string
  author: Author
  badge: React.ReactNode
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col justify-center overflow-hidden px-6 py-20 sm:px-10"
      style={{ background: bg }}
    >
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4">
        {badge}
        {children}
      </div>
      <div className="absolute bottom-24 left-6 z-20 sm:bottom-8 sm:left-10">
        <AuthorRow author={author} />
      </div>
    </div>
  )
}

/** Shared like + comment-sheet state for a feed item, used by both the action rail and double-tap. */
function useCardEngagement() {
  const [liked, setLiked] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const toggleLike = () => setLiked((v) => !v)
  const likeOnDoubleTap = () => setLiked(true)
  return { liked, toggleLike, likeOnDoubleTap, commentsOpen, setCommentsOpen }
}

function DrabbleCard({ item }: { item: DrabbleItem }) {
  const { ref, played } = useInViewOnce()
  const { liked, toggleLike, likeOnDoubleTap, commentsOpen, setCommentsOpen } = useCardEngagement()
  return (
    <div ref={ref} className="relative h-full w-full">
      <DoubleTapLike onDoubleTap={likeOnDoubleTap}>
        <CardChrome
          bg={`linear-gradient(160deg, ${item.author.color}dd, #0b0b12)`}
          author={item.author}
          badge={<TypeBadge>Drabble</TypeBadge>}
        >
          <h2 className="font-serif text-2xl text-white drop-shadow sm:text-3xl">{item.title}</h2>
          <TypedText
            text={item.text}
            play={played}
            className="font-serif text-lg leading-relaxed text-white/95 drop-shadow sm:text-xl"
            totalMs={550}
          />
        </CardChrome>
      </DoubleTapLike>
      <ActionRail
        likes={item.likes}
        comments={item.comments}
        liked={liked}
        onToggleLike={toggleLike}
        onOpenComments={() => setCommentsOpen(true)}
      />
      <CommentSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} count={item.comments} />
    </div>
  )
}

function LongformCard({ item }: { item: LongformItem }) {
  const { ref, played } = useInViewOnce()
  const { liked, toggleLike, likeOnDoubleTap, commentsOpen, setCommentsOpen } = useCardEngagement()
  return (
    <div ref={ref} className="relative h-full w-full">
      <DoubleTapLike onDoubleTap={likeOnDoubleTap}>
        <CardChrome
          bg={`linear-gradient(160deg, ${item.author.color}dd, #0b0b12)`}
          author={item.author}
          badge={<TypeBadge>{item.title}</TypeBadge>}
        >
          <TypedText
            text={item.intro}
            play={played}
            className="font-serif text-lg leading-relaxed text-white/95 drop-shadow sm:text-xl"
            totalMs={700}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              console.log('read more tapped (inert)')
            }}
            className={cn(
              'pointer-events-auto mt-1 w-fit rounded-full bg-white px-4 py-2 font-sans text-sm font-semibold text-ink shadow-lg transition-all duration-500',
              played ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            )}
            style={{ transitionDelay: played ? '650ms' : '0ms' }}
          >
            Read more →
          </button>
        </CardChrome>
      </DoubleTapLike>
      {/* fade-to-gradient hinting continued content */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
      <ActionRail
        likes={item.likes}
        comments={item.comments}
        liked={liked}
        onToggleLike={toggleLike}
        onOpenComments={() => setCommentsOpen(true)}
      />
      <CommentSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} count={item.comments} />
    </div>
  )
}

function ChatCard({ item }: { item: ChatItem }) {
  const { ref, played } = useInViewOnce()
  const { liked, toggleLike, likeOnDoubleTap, commentsOpen, setCommentsOpen } = useCardEngagement()
  return (
    <div ref={ref} className="relative h-full w-full">
      <DoubleTapLike onDoubleTap={likeOnDoubleTap}>
        <div
          className="relative flex h-full w-full flex-col justify-center overflow-hidden px-5 py-20 sm:px-10"
          style={{ background: `linear-gradient(160deg, ${item.author.color}bb, #0b0b12)` }}
        >
          <div className="absolute inset-0 bg-black/15" />
          <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4">
            <TypeBadge>Chat AU · {item.title}</TypeBadge>
            <ChatBubbles messages={item.messages} participants={item.participants} play={played} />
          </div>
          <div className="absolute bottom-24 left-5 z-20 sm:bottom-8 sm:left-10">
            <AuthorRow author={item.author} />
          </div>
        </div>
      </DoubleTapLike>
      <ActionRail
        likes={item.likes}
        comments={item.comments}
        liked={liked}
        onToggleLike={toggleLike}
        onOpenComments={() => setCommentsOpen(true)}
      />
      <CommentSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} count={item.comments} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReelsFeed() {
  return (
    <div className="fixed inset-0 bg-black">
      <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 font-sans text-sm font-semibold tracking-wide text-white/90">
        For You — prototype
      </div>
      <div
        className="h-full w-full snap-y snap-mandatory overflow-y-scroll scroll-smooth"
        style={{ height: '100dvh' }}
      >
        {FEED.map((item) => (
          <section key={item.id} className="relative h-screen w-full snap-start" style={{ height: '100dvh' }}>
            {item.type === 'drabble' && <DrabbleCard item={item} />}
            {item.type === 'longform' && <LongformCard item={item} />}
            {item.type === 'chat' && <ChatCard item={item} />}
          </section>
        ))}
      </div>
    </div>
  )
}
