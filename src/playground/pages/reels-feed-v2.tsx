// Throwaway playground prototype: reels-style feed rebuilt from the Figma spec.
// Light mode only. All content is fake and inline — this exists to feel out
// interaction and visual design, nothing here touches real data.
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import {
  Bell,
  Bookmark,
  ChevronLeft,
  Compass,
  Heart,
  Library,
  MessageCircle,
  PenLine,
  Share2,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Tokens (straight from the Figma export)
// ---------------------------------------------------------------------------

const INK = '#2A241F'
const MUTED = '#645F5B'
const PAGE_BG = '#F6F4F1'
const LIKE_RED = '#E0245E'
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", system-ui, sans-serif'
const SERIF = 'Georgia, "Times New Roman", serif'

const PAD = 16
const CARD_GAP = 15
const CARD_RATIO = 0.85
const TOGGLE_H = 42
const HEADER_H = 82
const COMMENTS_H = 88
const CONTROLS_H = 48
const NAV_H = 57
const MAX_SECTION_GAP = 29
const NAV_HEIGHT_CSS = `calc(${NAV_H}px + env(safe-area-inset-bottom))`

const PROSE_FONT_SIZE = 14
const PROSE_LINE = 23
const BUBBLE_GAP = 8

function sans(size: number, line: number, weight = 400, color = INK): CSSProperties {
  return {
    fontFamily: SANS,
    fontSize: size,
    lineHeight: `${line}px`,
    fontWeight: weight,
    letterSpacing: size >= 14 ? -0.3 : -0.15,
    color,
  }
}

const PROSE_STYLE: CSSProperties = {
  fontFamily: SERIF,
  fontSize: PROSE_FONT_SIZE,
  lineHeight: `${PROSE_LINE}px`,
  color: INK,
}

const BUBBLE_STYLE: CSSProperties = {
  maxWidth: '80%',
  padding: '8px 12px',
  borderRadius: 16,
  fontFamily: SANS,
  fontSize: 14,
  lineHeight: '20px',
  letterSpacing: -0.3,
}

const KEYFRAMES = `
@keyframes pf-row-in { from { height: 0; opacity: 0 } to { height: var(--pf-h); opacity: 1 } }
@keyframes pf-bubble-in { from { opacity: 0; transform: translateY(6px) scale(0.96) } to { opacity: 1; transform: none } }
@keyframes pf-dot { 0%, 80%, 100% { opacity: 0.25; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-2px) } }
@keyframes pf-heart {
  0% { opacity: 0; transform: scale(0.5) }
  25% { opacity: 0.95; transform: scale(1.12) }
  45% { transform: scale(0.95) }
  70% { opacity: 0.95; transform: scale(1) }
  100% { opacity: 0; transform: scale(1.15) }
}
.pf-row { animation: pf-row-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both; overflow: hidden }
.pf-bubble { animation: pf-bubble-in 260ms ease-out both }
.pf-hide-scrollbar { scrollbar-width: none }
.pf-hide-scrollbar::-webkit-scrollbar { display: none }
`

// ---------------------------------------------------------------------------
// Fake data
// ---------------------------------------------------------------------------

interface Person {
  name: string
  initials: string
  color: string
  bio?: string
}

interface FeedComment {
  user: Person
  text: string
}

interface Counts {
  comments: number
  shares: number
  saves: number
  likes: number
}

interface BaseItem {
  id: string
  title: string
  author: Person
  caption: string
  tags: string[]
  comments: FeedComment[]
  counts: Counts
}

interface ProseItem extends BaseItem {
  kind: 'prose'
  chapter?: { number: number; story: string }
  paragraphs: string[]
}

interface ChatItem extends BaseItem {
  kind: 'chat'
  participants: { a: { name: string; color: string }; b: { name: string; color: string } }
  messages: { from: 'a' | 'b'; text: string }[]
}

type FeedItem = ProseItem | ChatItem

const YOU: Person = { name: 'you', initials: 'MV', color: '#0087A6' }

const maravance: Person = { name: 'maravance', initials: 'MV', color: '#6366F1', bio: 'slow burns and worse decisions. requests open.' }
const rosalindo: Person = { name: 'rosalindo', initials: 'RO', color: '#7C5CFA', bio: 'magical realism enjoyer. i write orchards a lot.' }
const margueritedx: Person = { name: 'margueritedx', initials: 'MD', color: '#D0643F', bio: 'sci-fi aus with too many radio metaphors' }
const theovance: Person = { name: 'theovance', initials: 'TV', color: '#4E9A70', bio: 'mystery, angst, lighthouses.' }
const quillandash: Person = { name: 'quillandash', initials: 'QA', color: '#B8527A', bio: 'drabbles at 3am' }
const omegaArchivist: Person = { name: 'omega_archivist', initials: 'OA', color: '#3E7C5A', bio: 'archiving every OMEGA moment that lives in my head' }
const jaeminluvr: Person = { name: 'jaeminluvr', initials: 'JL', color: '#C2548B', bio: 'jaehyun x minhyuk only. do not perceive me.' }
const minhyukfilms: Person = { name: 'minhyukfilms', initials: 'MF', color: '#2F6FB0', bio: 'long fics about comeback season feelings' }
const omegafics: Person = { name: 'omegafics', initials: 'OF', color: '#AC9436', bio: 'soft OMEGA drabbles, updated whenever' }

const hak2002: Person = { name: 'hak2002', initials: 'AL', color: '#148500' }
const haobinLuvr: Person = { name: 'haobin_luvr', initials: 'JM', color: '#AC9436' }
const starlitsoo: Person = { name: 'starlitsoo', initials: 'SS', color: '#6366F1' }
const velvetmic: Person = { name: 'velvetmic', initials: 'VM', color: '#0087A6' }
const bridgeverse: Person = { name: 'bridgeverse', initials: 'BV', color: '#D0643F' }
const yeonnie: Person = { name: 'yeonnie_', initials: 'YN', color: '#C2548B' }

const FOR_YOU: FeedItem[] = [
  {
    id: 'door',
    kind: 'prose',
    title: 'The Door in the Floor',
    author: maravance,
    caption: 'based on a request 🥺',
    chapter: { number: 5, story: 'The Salt Cathedral' },
    tags: [
      'whump',
      'pov-alternating',
      'forbidden-love',
      'pining',
      'dark academia',
      'slow burn',
      'hurt/comfort',
      'found family',
      'enemies to lovers',
      'angst',
      'mutual pining',
      'canon divergence',
      'alternate universe',
      'fluff',
      'mystery',
    ],
    comments: [
      { user: hak2002, text: 'bruh i am sobbing and throwing up' },
      { user: haobinLuvr, text: 'HAOBIN!! HAO!! BIN!!!!!' },
    ],
    counts: { comments: 13, shares: 34, saves: 34, likes: 482 },
    paragraphs: [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      'Ut enim ad minim veniam.',
      'Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit.',
      'Mauris feugiat, nibh at faucibus dictum, lorem sapien congue nisi, vitae hendrerit mi erat non lectus.',
      'Donec consequat dignissim diam, sed ultricies odio. Curabitur tincidunt, velit eget varius bibendum, nulla sem luctus massa, nec semper nunc justo sed nibh.',
      'Maecenas scelerisque, quam a condimentum commodo, turpis nunc feugiat risus, id elementum libero nibh at augue.',
      '“Cras venenatis,” she said, “pretium lectus sed facilisis.”',
      'Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.',
    ],
  },
  {
    id: 'orchard',
    kind: 'prose',
    title: 'The Glass Orchard',
    author: rosalindo,
    caption: "unbeta'd, we die like fans",
    tags: ['fluff', 'magical realism', 'hurt/comfort', 'grief', 'short and sweet'],
    comments: [
      { user: starlitsoo, text: 'okay but the ending??' },
      { user: velvetmic, text: 'her mother’s laugh. i’m on the floor' },
    ],
    counts: { comments: 31, shares: 12, saves: 58, likes: 482 },
    paragraphs: [
      "Lorem ipsum dolor sit amet, the orchard hummed at dusk. Each tree held a memory instead of fruit, and she picked the ripest one — her mother's laugh, still warm.",
      "Consectetur adipiscing elit, the gardener never told anyone what she'd done with the rest.",
    ],
  },
  {
    id: 'static',
    kind: 'chat',
    title: 'Static on the Line',
    author: margueritedx,
    caption: 'chat au, part 1 of 3',
    tags: ['sci-fi au', 'slow burn', 'college au', 'epistolary'],
    comments: [
      { user: bridgeverse, text: 'not me rereading this' },
      { user: hak2002, text: 'need part 2 NOW' },
    ],
    counts: { comments: 118, shares: 40, saves: 212, likes: 901 },
    participants: { a: { name: 'Ines', color: '#4E9A70' }, b: { name: 'Cal', color: '#D0643F' } },
    messages: [
      { from: 'a', text: 'lorem ipsum, you still up?' },
      { from: 'b', text: 'dolor sit amet. obviously' },
      { from: 'a', text: 'the relay went dark again. same frequency as before' },
      { from: 'b', text: 'consectetur adipiscing — how long this time' },
      { from: 'a', text: 'four minutes. then a voice' },
      { from: 'b', text: 'whose voice' },
      { from: 'a', text: 'yours' },
      { from: 'b', text: "that's not funny" },
      { from: 'a', text: "i'm not joking. it said my name the way you do" },
      { from: 'b', text: "stay where you are. i'm coming over" },
    ],
  },
  {
    id: 'harbor',
    kind: 'prose',
    title: 'Harbor of Small Regrets',
    author: theovance,
    caption: 'this one hurt to write',
    chapter: { number: 2, story: 'Lighthouse Keeping' },
    tags: ['angst', 'slow burn', 'mystery', 'lighthouse au'],
    comments: [
      { user: yeonnie, text: 'the lighthouse keeper deserves better' },
      { user: starlitsoo, text: 'counting ships like that is so specific and so sad' },
    ],
    counts: { comments: 76, shares: 22, saves: 140, likes: 1204 },
    paragraphs: [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. The lighthouse keeper counted ships the way other people counted sheep, and slept about as well.',
      'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.',
      'Laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.',
      'Eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.',
      'Sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus, nulla gravida orci a odio.',
      'Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.',
    ],
  },
  {
    id: 'small-hours',
    kind: 'prose',
    title: 'Small Hours',
    author: quillandash,
    caption: 'wrote this instead of sleeping',
    tags: ['drabble', 'insomnia', 'comfort'],
    comments: [
      { user: velvetmic, text: 'the kettle line got me' },
      { user: bridgeverse, text: 'saving this for bad nights' },
    ],
    counts: { comments: 9, shares: 5, saves: 44, likes: 233 },
    paragraphs: [
      'Lorem ipsum dolor sit amet, the kettle clicked off at 3:12 and neither of them moved to pour it.',
      'Consectetur adipiscing elit. Some nights the point of making tea is only that someone else is awake to hear it boil.',
    ],
  },
]

const FOLLOWING: FeedItem[] = [
  {
    id: 'trainee-4b',
    kind: 'prose',
    title: 'Trainee Room 4B',
    author: omegaArchivist,
    caption: 'pre-debut feelings, again',
    tags: ['omega', 'jaehyun x minhyuk', 'pre-debut', 'trainee era', 'fluff'],
    comments: [
      { user: yeonnie, text: 'the unlocked door. i am unwell' },
      { user: starlitsoo, text: 'minhyuk you absolute softie' },
    ],
    counts: { comments: 144, shares: 61, saves: 390, likes: 1920 },
    paragraphs: [
      "Before OMEGA had a name, they had a room with bad lighting and a mirror wall that lied about how far they'd come. Jaehyun learned harmony parts by humming them into his pillow at 2AM so the RA wouldn't hear.",
      'Minhyuk heard anyway. He never said so. He just started leaving the practice room door unlocked.',
    ],
  },
  {
    id: 'dorm-gc',
    kind: 'chat',
    title: 'dorm gc (OMEGA)',
    author: jaeminluvr,
    caption: 'recording day eve 😭',
    tags: ['omega', 'jaehyun x minhyuk', 'chat au', 'fluff', 'recording era'],
    comments: [
      { user: haobinLuvr, text: 'the bad snacks are the good snacks. canon' },
      { user: bridgeverse, text: 'DEAL?? DEAL.' },
    ],
    counts: { comments: 88, shares: 30, saves: 201, likes: 1403 },
    participants: { a: { name: 'Minhyuk', color: '#7C5CFA' }, b: { name: 'Jaehyun', color: '#D0643F' } },
    messages: [
      { from: 'a', text: 'are you awake' },
      { from: 'b', text: 'no' },
      { from: 'a', text: "then who's typing" },
      { from: 'b', text: "the ghost of this dorm's water pressure" },
      { from: 'a', text: "i can't sleep. we're recording tomorrow" },
      { from: 'b', text: "you've sung that bridge a hundred times" },
      { from: 'a', text: 'a hundred and one tomorrow' },
      { from: 'b', text: 'come to the practice room. bring the bad snacks' },
      { from: 'a', text: 'the bad snacks are the good snacks' },
      { from: 'b', text: "we'll run it once and then you're sleeping. deal?" },
      { from: 'a', text: 'deal' },
    ],
  },
  {
    id: 'comeback-week',
    kind: 'prose',
    title: 'Comeback Week',
    author: minhyukfilms,
    caption: 'ch 3 is here, thank you for waiting',
    chapter: { number: 3, story: 'Encore Season' },
    tags: ['omega', 'jaehyun x minhyuk', 'slow burn', 'comeback era', 'idol au', 'mutual pining'],
    comments: [
      { user: hak2002, text: 'hit it on purpose. HIT IT ON PURPOSE' },
      { user: yeonnie, text: 'the choreographer moving the mark 😭' },
    ],
    counts: { comments: 312, shares: 140, saves: 980, likes: 5402 },
    paragraphs: [
      'The dress rehearsal ran long, the way dress rehearsals always did, and by the time the lights cut out for the last run-through the whole of OMEGA had gone quiet in the specific way that meant they were too tired to be nervous.',
      'Jaehyun sat on the edge of the stage with his in-ear hanging loose against his collarbone. Minhyuk found him there, two bottles of water in one hand.',
      '“You missed your mark on the second chorus,” Minhyuk said, handing one over.',
      '“I know.”',
      '“It looked better.”',
      'Jaehyun laughed, and it echoed in the empty arena, bouncing off ten thousand seats that would be full in fourteen hours.',
      "Neither of them mentioned the choreographer, or the camera director, or the fact that the mark had been moved exactly so the two of them would stop drifting toward each other on the bridge. Some things you didn't fix. Some things you just learned to hit on purpose.",
      'Minhyuk sat down beside him, close enough that their shoulders touched, and for a while neither of them said anything at all.',
    ],
  },
  {
    id: 'soundcheck',
    kind: 'prose',
    title: 'Soundcheck',
    author: omegafics,
    caption: 'tiny one for the timeline',
    tags: ['omega', 'jaehyun x minhyuk', 'drabble', 'tour era'],
    comments: [
      { user: velvetmic, text: 'every single time 😭' },
      { user: starlitsoo, text: 'he does it on purpose and we all know it' },
    ],
    counts: { comments: 40, shares: 18, saves: 150, likes: 870 },
    paragraphs: [
      'Soundcheck is the only time the arena belongs to them. Minhyuk plays the opening bars wrong on purpose, just to watch Jaehyun turn around.',
      'It works every single time.',
    ],
  },
  {
    id: 'two-fourteen',
    kind: 'chat',
    title: '2:14 AM',
    author: omegaArchivist,
    caption: 'the variety show clip made me do this',
    tags: ['omega', 'jaehyun x minhyuk', 'chat au', 'confession'],
    comments: [
      { user: bridgeverse, text: "“i'm smiling too much to type” IM GONNA SCREAM" },
      { user: haobinLuvr, text: 'okay?? OKAY??' },
    ],
    counts: { comments: 204, shares: 99, saves: 610, likes: 3310 },
    participants: { a: { name: 'Jaehyun', color: '#D0643F' }, b: { name: 'Minhyuk', color: '#7C5CFA' } },
    messages: [
      { from: 'a', text: 'did you mean it' },
      { from: 'b', text: 'mean what' },
      { from: 'a', text: "on the variety show. when you said you'd pick me" },
      { from: 'b', text: 'it was a game, jae' },
      { from: 'a', text: "that's not an answer" },
      { from: 'b', text: '…yeah. i meant it' },
      { from: 'a', text: 'okay' },
      { from: 'b', text: 'okay?' },
      { from: 'a', text: "go to sleep minhyuk. i'm smiling too much to type" },
    ],
  },
  {
    id: 'understudy',
    kind: 'prose',
    title: 'The Understudy Slot',
    author: jaeminluvr,
    caption: 'new series!! center position au',
    chapter: { number: 1, story: 'Center Position' },
    tags: ['omega', 'jaehyun x minhyuk', 'rivals to lovers', 'idol au', 'slow burn'],
    comments: [
      { user: yeonnie, text: 'rivals to lovers OMEGA au i’ve been waiting' },
      { user: hak2002, text: 'subscribed immediately' },
    ],
    counts: { comments: 97, shares: 45, saves: 330, likes: 2105 },
    paragraphs: [
      "The evaluation sheet had two names in the center-position box, and one of them was written in pencil.",
      "Jaehyun noticed first, because Jaehyun noticed everything that might be taken from him. Minhyuk noticed second, because he was watching Jaehyun notice.",
      '“It’s just for the showcase,” their manager said, which was the kind of thing people said right before it stopped being just for the showcase.',
      "They practiced the center formation in shifts for a week. Jaehyun at eight, Minhyuk at ten, the rest of OMEGA drifting through the doorway to pretend they weren't keeping score.",
      "On the eighth night, Minhyuk came in early and found Jaehyun still there, sitting in the center mark with his back against the mirror, not dancing at all.",
      '“Take it,” Jaehyun said, before Minhyuk could say anything. “You’re better at the turn.”',
      "Minhyuk sat down across from him on the scuffed floor. “I don't want it if you're sad about it.”",
    ],
  },
]

const EXTRA_COMMENTS: FeedComment[] = [
  { user: starlitsoo, text: 'the pacing on this is unreal' },
  { user: velvetmic, text: 'reading this on my lunch break was a mistake' },
  { user: bridgeverse, text: 'author please i have a family' },
  { user: yeonnie, text: 'screenshotting the whole thing' },
]

const ALL_ITEMS = [...FOR_YOU, ...FOLLOWING]

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

// ---------------------------------------------------------------------------
// Measuring: pagination (no scrolling inside a card) and tag overflow
// ---------------------------------------------------------------------------

let measureRoot: HTMLDivElement | null = null

function getMeasureRoot(width: number, font: CSSProperties): HTMLDivElement {
  if (!measureRoot) {
    measureRoot = document.createElement('div')
    Object.assign(measureRoot.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
    })
    document.body.appendChild(measureRoot)
  }
  Object.assign(measureRoot.style, {
    width: `${width}px`,
    fontFamily: String(font.fontFamily),
    fontSize: `${font.fontSize}px`,
    lineHeight: String(font.lineHeight),
    letterSpacing: font.letterSpacing === undefined ? 'normal' : `${font.letterSpacing}px`,
  })
  return measureRoot
}

function paginateProse(paragraphs: string[], width: number, height: number): string[][] {
  const root = getMeasureRoot(width, PROSE_STYLE)
  const fits = (paras: string[]) => {
    root.replaceChildren(
      ...paras.map((text, i) => {
        const p = document.createElement('p')
        p.style.margin = '0'
        if (i > 0) p.style.marginTop = `${PROSE_LINE}px`
        p.textContent = text
        return p
      }),
    )
    return root.getBoundingClientRect().height <= height
  }

  const pages: string[][] = []
  let current: string[] = []
  for (const paragraph of paragraphs) {
    let words = paragraph.split(' ')
    while (words.length > 0) {
      const whole = words.join(' ')
      if (fits([...current, whole])) {
        current.push(whole)
        words = []
        continue
      }
      // Largest prefix of this paragraph that still fits on the current page.
      let lo = 0
      let hi = words.length - 1
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        if (fits([...current, words.slice(0, mid).join(' ')])) lo = mid
        else hi = mid - 1
      }
      if (lo > 0) {
        current.push(words.slice(0, lo).join(' '))
        words = words.slice(lo)
      } else if (current.length === 0) {
        current.push(words[0])
        words = words.slice(1)
      }
      pages.push(current)
      current = []
    }
  }
  if (current.length > 0) pages.push(current)
  return pages
}

function paginateChat(messages: ChatItem['messages'], width: number, height: number): ChatItem['messages'][] {
  const root = getMeasureRoot(width, BUBBLE_STYLE)
  const fits = (msgs: ChatItem['messages']) => {
    root.replaceChildren(
      ...msgs.map((m, i) => {
        const row = document.createElement('div')
        row.style.display = 'flex'
        row.style.justifyContent = m.from === 'b' ? 'flex-end' : 'flex-start'
        if (i > 0) row.style.marginTop = `${BUBBLE_GAP}px`
        const bubble = document.createElement('div')
        Object.assign(bubble.style, { maxWidth: '80%', padding: '8px 12px' })
        bubble.textContent = m.text
        row.appendChild(bubble)
        return row
      }),
    )
    return root.getBoundingClientRect().height <= height
  }

  const pages: ChatItem['messages'][] = []
  let current: ChatItem['messages'] = []
  for (const message of messages) {
    if (current.length === 0 || fits([...current, message])) {
      current.push(message)
    } else {
      pages.push(current)
      current = [message]
    }
  }
  if (current.length > 0) pages.push(current)
  return pages
}

let measureCanvas: CanvasRenderingContext2D | null = null

function textWidth(text: string): number {
  measureCanvas ??= document.createElement('canvas').getContext('2d')
  if (!measureCanvas) return text.length * 7
  measureCanvas.font = `400 14px ${SANS}`
  return measureCanvas.measureText(text).width - 0.3 * text.length
}

/** How many tags fit on one line, leaving room for a "+N…" label if any are hidden. */
function visibleTagCount(tags: string[], maxWidth: number): number {
  let used = 0
  for (let i = 0; i < tags.length; i++) {
    const next = used + (i > 0 ? 8 : 0) + textWidth(tags[i])
    const hidden = tags.length - i - 1
    const labelWidth = hidden > 0 ? 8 + textWidth(`+${hidden}…`) : 0
    if (next + labelWidth > maxWidth) return i
    used = next
  }
  return tags.length
}

// ---------------------------------------------------------------------------
// Small hooks
// ---------------------------------------------------------------------------

function useElementSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    if (!el) return
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [el])
  return [setEl, size] as const
}

function usePlayedOnce<T extends Element>() {
  const ref = useRef<T | null>(null)
  const [played, setPlayed] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || played) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlayed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.55 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [played])
  return { ref, played }
}

function useMountTransition(open: boolean, ms: number) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      let inner = 0
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true))
      })
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
      }
    }
    setShown(false)
    const t = window.setTimeout(() => setMounted(false), ms)
    return () => window.clearTimeout(t)
  }, [open, ms])
  return { mounted, shown }
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Avatar({ person, size = 24 }: { person: Person; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: person.color,
        color: '#FFFFFF',
        fontFamily: SANS,
        fontSize: size * (10 / 24),
        fontWeight: 600,
        letterSpacing: -0.33,
      }}
    >
      {person.initials}
    </span>
  )
}

function ChapterLine({ chapter }: { chapter: { number: number; story: string } }) {
  return (
    <div className="flex items-center" style={{ gap: 4, height: 24 }}>
      <span style={{ ...sans(14, 20), opacity: 0.7, whiteSpace: 'nowrap' }}>Chapter {chapter.number} of ? in</span>
      <span style={{ fontFamily: SERIF, fontSize: 14, lineHeight: '20px', color: INK, whiteSpace: 'nowrap' }}>
        {chapter.story}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card contents
// ---------------------------------------------------------------------------

function CardShell({
  size,
  index,
  played,
  children,
}: {
  size: number
  index: number
  played: boolean
  children: ReactNode
}) {
  return (
    <div
      className="flex shrink-0 items-center"
      style={{
        width: size,
        height: size,
        padding: PAD,
        background: '#FFFFFF',
        borderRadius: 4,
        boxShadow: '0px 0px 40px rgba(100, 95, 91, 0.05)',
        opacity: played ? 1 : 0,
        transform: played ? 'none' : 'translateY(12px)',
        transition: `opacity 450ms ease-out ${index * 70}ms, transform 450ms ease-out ${index * 70}ms`,
      }}
    >
      <div className="w-full">{children}</div>
    </div>
  )
}

/** Words fade in in order. Spaces stay real text nodes so wrapping is untouched. */
function ProsePage({ paragraphs, animate, shown }: { paragraphs: string[]; animate: boolean; shown: boolean }) {
  if (!animate) {
    return (
      <div style={PROSE_STYLE}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ margin: 0, marginTop: i > 0 ? PROSE_LINE : 0 }}>
            {p}
          </p>
        ))}
      </div>
    )
  }
  const totalWords = paragraphs.reduce((n, p) => n + p.split(' ').length, 0)
  const step = Math.min(18, 750 / Math.max(totalWords, 1))
  let wordIndex = 0
  return (
    <div style={PROSE_STYLE}>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ margin: 0, marginTop: i > 0 ? PROSE_LINE : 0 }}>
          {p.split(' ').map((word, j) => {
            const delay = wordIndex++ * step
            return (
              <Fragment key={j}>
                {j > 0 ? ' ' : null}
                <span style={{ opacity: shown ? 1 : 0, transition: `opacity 220ms ease-out ${delay}ms` }}>{word}</span>
              </Fragment>
            )
          })}
        </p>
      ))}
    </div>
  )
}

function proseRevealMs(paragraphs: string[]): number {
  const words = paragraphs.reduce((n, p) => n + p.split(' ').length, 0)
  return Math.min(18, 750 / Math.max(words, 1)) * words + 220
}

const TYPING_MS = 380
const BUBBLE_PAUSE_MS = 160

function ChatPage({
  messages,
  participants,
  animate,
  shown,
}: {
  messages: ChatItem['messages']
  participants: ChatItem['participants']
  animate: boolean
  shown: boolean
}) {
  const [visible, setVisible] = useState(animate ? 0 : messages.length)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    if (!animate || !shown) return
    const timers: number[] = []
    let t = 0
    messages.forEach((_, i) => {
      timers.push(window.setTimeout(() => setTyping(true), t))
      t += TYPING_MS
      timers.push(
        window.setTimeout(() => {
          setTyping(false)
          setVisible(i + 1)
        }, t),
      )
      t += BUBBLE_PAUSE_MS
    })
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [animate, shown, messages])

  const next = messages[visible]
  return (
    <div>
      {messages.slice(0, visible).map((m, i) => (
        <div
          key={i}
          className={animate ? 'pf-bubble' : undefined}
          style={{
            display: 'flex',
            justifyContent: m.from === 'b' ? 'flex-end' : 'flex-start',
            marginTop: i > 0 ? BUBBLE_GAP : 0,
          }}
        >
          <div style={{ ...BUBBLE_STYLE, background: participants[m.from].color, color: '#FFFFFF' }}>{m.text}</div>
        </div>
      ))}
      {typing && next && (
        <div
          className="pf-bubble"
          style={{
            display: 'flex',
            justifyContent: next.from === 'b' ? 'flex-end' : 'flex-start',
            marginTop: visible > 0 ? BUBBLE_GAP : 0,
          }}
        >
          <div className="flex items-center" style={{ ...BUBBLE_STYLE, background: '#ECE8E3', gap: 4, height: 36 }}>
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  background: MUTED,
                  animation: `pf-dot 1s ease-in-out ${d * 140}ms infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function chatRevealMs(messages: ChatItem['messages']): number {
  return messages.length * (TYPING_MS + BUBBLE_PAUSE_MS)
}

function KeepReadingCard({ item, onRead }: { item: ProseItem; onRead: () => void }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ gap: 12 }}>
      <div style={{ fontFamily: SERIF, fontSize: 20, lineHeight: '26px', color: INK }}>Keep reading</div>
      {item.chapter && (
        <div style={sans(14, 20, 400, MUTED)}>
          Chapter {item.chapter.number} continues in {item.chapter.story}
        </div>
      )}
      <button
        type="button"
        onClick={onRead}
        style={{ ...sans(14, 20, 600, '#FFFFFF'), background: INK, borderRadius: 4, padding: '10px 16px', marginTop: 4 }}
      >
        Read full chapter
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Carousel: equal square cards in one track, follows the thumb
// ---------------------------------------------------------------------------

interface Gesture {
  id: number
  x: number
  y: number
  t: number
  axis: 'x' | 'y' | null
}

function Carousel({
  size,
  count,
  onDoubleTap,
  children,
}: {
  size: number
  count: number
  onDoubleTap: () => void
  children: ReactNode
}) {
  const [index, setIndex] = useState(0)
  const [drag, setDrag] = useState(0)
  const [settling, setSettling] = useState(false)
  const [burst, setBurst] = useState(0)
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef(0)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), axis: null }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (g.axis === null) {
      if (Math.hypot(dx, dy) < 8) return
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (g.axis === 'x') {
        e.currentTarget.setPointerCapture(e.pointerId)
        setSettling(false)
      }
    }
    if (g.axis !== 'x') return
    const atEdge = (index === 0 && dx > 0) || (index === count - 1 && dx < 0)
    setDrag(atEdge ? dx * 0.35 : dx)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    if (!g || g.id !== e.pointerId) return

    if (g.axis === 'x') {
      const dx = e.clientX - g.x
      const fast = performance.now() - g.t < 250 && Math.abs(dx) > 30
      const threshold = fast ? 0 : size * 0.2
      let next = index
      if (dx < -threshold && index < count - 1) next = index + 1
      else if (dx > threshold && index > 0) next = index - 1
      setSettling(true)
      setIndex(next)
      setDrag(0)
      return
    }

    if (g.axis === null) {
      if ((e.target as Element).closest('button')) return
      const now = Date.now()
      if (now - lastTap.current < 300) {
        lastTap.current = 0
        onDoubleTap()
        setBurst((b) => b + 1)
      } else {
        lastTap.current = now
      }
    }
  }

  const onPointerCancel = () => {
    gesture.current = null
    setSettling(true)
    setDrag(0)
  }

  const offset = -index * (size + CARD_GAP) + drag

  return (
    <div
      className="relative select-none overflow-hidden"
      style={{ marginLeft: -PAD, width: `calc(100% + ${PAD * 2}px)`, paddingLeft: PAD, height: size, touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className="flex"
        style={{
          gap: CARD_GAP,
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: settling ? 'transform 320ms cubic-bezier(0.22, 0.8, 0.25, 1)' : 'none',
        }}
      >
        {children}
      </div>
      {burst > 0 && (
        <div
          key={burst}
          className="pointer-events-none absolute top-0 z-10 flex items-center justify-center"
          style={{ left: PAD, width: size, height: size }}
        >
          <Heart
            size={96}
            fill={LIKE_RED}
            color={LIKE_RED}
            strokeWidth={1}
            style={{ animation: 'pf-heart 700ms ease-out both', filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.18))' }}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feed section (one full-height snap page)
// ---------------------------------------------------------------------------

function ActionButton({ count, onClick, children }: { count: number; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center" style={{ gap: 4, minWidth: 24 }}>
      <span style={{ ...sans(12, 16, 500, MUTED), letterSpacing: -0.15 }}>{formatCount(count)}</span>
      {children}
    </button>
  )
}

function FeedSection({
  item,
  size,
  width,
  height,
  onOpenComments,
  onOpenProfile,
  onOpenReader,
}: {
  item: FeedItem
  size: number
  width: number
  height: number
  onOpenComments: (item: FeedItem) => void
  onOpenProfile: (person: Person) => void
  onOpenReader: (item: ProseItem) => void
}) {
  const { ref, played } = usePlayedOnce<HTMLElement>()
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [rows, setRows] = useState(0)

  const inner = size - PAD * 2
  const pages = useMemo(
    () =>
      item.kind === 'prose'
        ? paginateProse(item.paragraphs, inner, inner)
        : paginateChat(item.messages, inner, inner),
    [item, inner],
  )
  const hasKeepReading = item.kind === 'prose' && item.chapter !== undefined
  const cardCount = pages.length + (hasKeepReading ? 1 : 0)

  const firstPageRevealMs =
    item.kind === 'prose'
      ? proseRevealMs(pages[0] as string[])
      : chatRevealMs(pages[0] as ChatItem['messages'])

  useEffect(() => {
    if (!played) return
    const start = firstPageRevealMs + 150
    const timers = [1, 2, 3].map((n, i) => window.setTimeout(() => setRows(n), start + i * 700))
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [played, firstPageRevealMs])

  const free = height - (PAD + TOGGLE_H + HEADER_H + size + COMMENTS_H + CONTROLS_H + PAD)
  const gap = Math.max(8, Math.min(MAX_SECTION_GAP, Math.floor(free / 4)))

  const tagCount = visibleTagCount(item.tags, width - PAD * 2)
  const hiddenTags = item.tags.length - tagCount

  const commentRows: FeedComment[] = [{ user: item.author, text: item.caption }, ...item.comments.slice(0, 2)]

  return (
    <section ref={ref} className="relative w-full snap-start" style={{ height, background: PAGE_BG, scrollSnapStop: 'always' }}>
      <div
        className="flex h-full flex-col"
        style={{ padding: PAD, paddingTop: `calc(${PAD + TOGGLE_H + gap}px + env(safe-area-inset-top))`, gap }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 flex-col items-center justify-center"
          style={{
            height: HEADER_H,
            opacity: played ? 1 : 0,
            transition: 'opacity 400ms ease-out',
          }}
        >
          <div
            className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center"
            style={{ fontFamily: SERIF, fontSize: 24, lineHeight: '30px', color: INK }}
          >
            {item.title}
          </div>
          {item.kind === 'prose' && item.chapter && <ChapterLine chapter={item.chapter} />}
          <div className="flex items-center justify-center" style={{ paddingTop: 8, gap: 8, height: 28 }}>
            {item.tags.slice(0, tagCount).map((tag) => (
              <span
                key={tag}
                style={{
                  ...sans(14, 20, 400, MUTED),
                  whiteSpace: 'nowrap',
                  textDecorationLine: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                {tag}
              </span>
            ))}
            {hiddenTags > 0 && (
              <span style={{ ...sans(14, 20, 400, MUTED), whiteSpace: 'nowrap' }}>+{hiddenTags}…</span>
            )}
          </div>
        </div>

        {/* Cards */}
        <div className="flex min-h-0 flex-1 items-center">
          <Carousel size={size} count={cardCount} onDoubleTap={() => setLiked(true)}>
            {pages.map((page, i) => (
              <CardShell key={i} size={size} index={i} played={played}>
                {item.kind === 'prose' ? (
                  <ProsePage paragraphs={page as string[]} animate={i === 0} shown={played} />
                ) : (
                  <ChatPage
                    messages={page as ChatItem['messages']}
                    participants={item.participants}
                    animate={i === 0}
                    shown={played}
                  />
                )}
              </CardShell>
            ))}
            {hasKeepReading && item.kind === 'prose' && (
              <CardShell size={size} index={pages.length} played={played}>
                <KeepReadingCard item={item} onRead={() => onOpenReader(item)} />
              </CardShell>
            )}
          </Carousel>
        </div>

        {/* Caption + comments: rows grow in at the bottom and push earlier rows up */}
        <div className="flex shrink-0 flex-col justify-end overflow-hidden" style={{ height: COMMENTS_H }}>
          {commentRows.slice(0, rows).map((row, i) => (
            <div key={i} className="pf-row" style={{ ['--pf-h' as string]: `${i === 0 ? 24 : 32}px` } as CSSProperties}>
              {i > 0 && <div style={{ height: 8 }} />}
              <div className="flex items-center" style={{ height: 24, gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onOpenProfile(row.user)}
                  className="flex shrink-0 items-center"
                  style={{ gap: 4 }}
                >
                  <Avatar person={row.user} />
                  <span style={{ ...sans(14, 20, 590), whiteSpace: 'nowrap' }}>{row.user.name}</span>
                </button>
                <span
                  className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                  style={sans(14, 20, 400, MUTED)}
                >
                  {row.text}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex shrink-0 items-center" style={{ height: CONTROLS_H }}>
          <button
            type="button"
            onClick={() => onOpenComments(item)}
            className="flex min-w-0 flex-1 items-center"
            style={{ gap: 8 }}
          >
            <Avatar person={YOU} />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap" style={sans(14, 20, 400, MUTED)}>
              Leave a comment…
            </span>
          </button>
          <div className="flex items-start" style={{ gap: 20 }}>
            <ActionButton count={item.counts.comments} onClick={() => onOpenComments(item)}>
              <MessageCircle size={24} strokeWidth={2} color={MUTED} />
            </ActionButton>
            <ActionButton count={item.counts.shares}>
              <Share2 size={28} strokeWidth={1.72} color={MUTED} />
            </ActionButton>
            <ActionButton count={item.counts.saves + (saved ? 1 : 0)} onClick={() => setSaved((s) => !s)}>
              <Bookmark size={28} strokeWidth={1.72} color={saved ? INK : MUTED} fill={saved ? INK : 'none'} />
            </ActionButton>
            <ActionButton count={item.counts.likes + (liked ? 1 : 0)} onClick={() => setLiked((l) => !l)}>
              <Heart size={28} strokeWidth={1.72} color={liked ? LIKE_RED : MUTED} fill={liked ? LIKE_RED : 'none'} />
            </ActionButton>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

function CommentSheet({ item, onClose }: { item: FeedItem | null; onClose: () => void }) {
  const { mounted, shown } = useMountTransition(item !== null, 300)
  const last = useRef<FeedItem | null>(item)
  if (item) last.current = item
  const current = last.current
  if (!mounted || !current) return null

  const comments = [{ user: current.author, text: current.caption }, ...current.comments, ...EXTRA_COMMENTS]
  return (
    <div className="absolute inset-0 z-50">
      <button
        type="button"
        aria-label="Close comments"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(42,36,31,0.3)', opacity: shown ? 1 : 0, transition: 'opacity 300ms ease-out' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col"
        style={{
          maxHeight: '72%',
          background: '#FFFFFF',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: shown ? 'none' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.22, 0.8, 0.25, 1)',
        }}
      >
        <div className="flex justify-center pt-2">
          <span className="rounded-full" style={{ width: 36, height: 4, background: 'rgba(42,36,31,0.15)' }} />
        </div>
        <div className="flex items-center justify-between" style={{ padding: '8px 16px 12px' }}>
          <span style={sans(14, 20, 600)}>{formatCount(current.counts.comments)} comments</span>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} color={MUTED} />
          </button>
        </div>
        <div className="pf-hide-scrollbar flex flex-col overflow-y-auto" style={{ gap: 16, padding: '0 16px 16px' }}>
          {comments.map((c, i) => (
            <div key={i} className="flex items-start" style={{ gap: 8 }}>
              <Avatar person={c.user} size={28} />
              <div className="flex flex-col">
                <span style={sans(13, 18, 590)}>{c.user.name}</span>
                <span style={sans(14, 20, 400, MUTED)}>{c.text}</span>
              </div>
            </div>
          ))}
        </div>
        <div
          className="flex items-center"
          style={{ gap: 8, padding: '10px 16px', borderTop: '1px solid rgba(42,36,31,0.1)' }}
        >
          <Avatar person={YOU} />
          <span style={sans(14, 20, 400, MUTED)}>Leave a comment…</span>
        </div>
      </div>
    </div>
  )
}

/** Full-screen page that slides in from the right; swipe right or tap back to close. */
function SidePanel({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const { mounted, shown } = useMountTransition(open, 300)
  const [drag, setDrag] = useState(0)
  const gesture = useRef<Gesture | null>(null)
  if (!mounted) return null

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), axis: null }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (g.axis === null) {
      if (Math.hypot(dx, dy) < 8) return
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (g.axis === 'x') e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (g.axis === 'x') setDrag(Math.max(0, dx))
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    if (g?.axis === 'x' && e.clientX - g.x > 90) onClose()
    setDrag(0)
  }

  return (
    <div
      className="pf-hide-scrollbar absolute inset-0 z-40 overflow-y-auto"
      style={{
        background: PAGE_BG,
        touchAction: 'pan-y',
        transform: shown ? `translate3d(${drag}px, 0, 0)` : 'translate3d(100%, 0, 0)',
        transition: drag > 0 ? 'none' : 'transform 300ms cubic-bezier(0.22, 0.8, 0.25, 1)',
        boxShadow: '-8px 0 32px rgba(42,36,31,0.08)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        gesture.current = null
        setDrag(0)
      }}
    >
      <div className="sticky top-0 z-10 flex items-center" style={{ height: 48, padding: '0 8px', background: PAGE_BG }}>
        <button type="button" onClick={onClose} aria-label="Back" className="flex items-center" style={{ padding: 8 }}>
          <ChevronLeft size={24} color={INK} />
        </button>
      </div>
      {children}
    </div>
  )
}

function ReaderContent({ item }: { item: ProseItem }) {
  return (
    <div style={{ padding: '8px 24px 48px' }}>
      <div className="flex flex-col items-center text-center" style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: SERIF, fontSize: 26, lineHeight: '32px', color: INK }}>{item.title}</div>
        {item.chapter && <ChapterLine chapter={item.chapter} />}
        <div className="flex items-center" style={{ gap: 6, marginTop: 12 }}>
          <Avatar person={item.author} />
          <span style={sans(14, 20, 590)}>{item.author.name}</span>
        </div>
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 17, lineHeight: '28px', color: INK }}>
        {[...item.paragraphs, ...item.paragraphs].map((p, i) => (
          <p key={i} style={{ margin: 0, marginTop: i > 0 ? 18 : 0 }}>
            {p}
          </p>
        ))}
      </div>
    </div>
  )
}

function ProfileContent({ person }: { person: Person }) {
  const works = ALL_ITEMS.filter((w) => w.author.name === person.name)
  return (
    <div style={{ padding: '8px 16px 48px' }}>
      <div className="flex flex-col items-center text-center" style={{ gap: 8, marginBottom: 24 }}>
        <Avatar person={person} size={72} />
        <div style={{ fontFamily: SERIF, fontSize: 24, lineHeight: '30px', color: INK }}>{person.name}</div>
        {person.bio && <div style={sans(14, 20, 400, MUTED)}>{person.bio}</div>}
      </div>
      <div style={{ ...sans(12, 16, 600, MUTED), textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
        Works
      </div>
      {works.length === 0 ? (
        <div style={sans(14, 20, 400, MUTED)}>No works yet — just here for the comments.</div>
      ) : (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {works.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between"
              style={{ background: '#FFFFFF', borderRadius: 4, padding: 16, boxShadow: '0 0 40px rgba(100,95,91,0.05)' }}
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate" style={{ fontFamily: SERIF, fontSize: 16, lineHeight: '22px', color: INK }}>
                  {w.title}
                </span>
                <span style={sans(13, 18, 400, MUTED)}>
                  {w.kind === 'chat' ? 'Chat AU' : w.kind === 'prose' && w.chapter ? `Chapter ${w.chapter.number}` : 'Drabble'}
                </span>
              </div>
              <span className="flex shrink-0 items-center" style={{ ...sans(12, 16, 500, MUTED), gap: 4 }}>
                <Heart size={14} color={MUTED} />
                {formatCount(w.counts.likes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fake tab screens
// ---------------------------------------------------------------------------

type Tab = 'discover' | 'library' | 'write' | 'notifications' | 'search'

function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: SERIF, fontSize: 24, lineHeight: '30px', color: INK, marginBottom: 16 }}>{children}</div>
  )
}

function WhiteRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center"
      style={{ background: '#FFFFFF', borderRadius: 4, padding: 16, gap: 12, boxShadow: '0 0 40px rgba(100,95,91,0.05)' }}
    >
      {children}
    </div>
  )
}

function TabScreen({ tab }: { tab: Exclude<Tab, 'discover'> }) {
  return (
    <div
      className="pf-hide-scrollbar absolute inset-x-0 top-0 z-30 overflow-y-auto"
      style={{
        bottom: NAV_HEIGHT_CSS,
        background: PAGE_BG,
        padding: `calc(${PAD * 1.5}px + env(safe-area-inset-top)) ${PAD}px ${PAD}px`,
      }}
    >
      {tab === 'library' && (
        <>
          <ScreenTitle>Library</ScreenTitle>
          <div className="flex flex-col" style={{ gap: 8 }}>
            {ALL_ITEMS.slice(0, 5).map((w, i) => (
              <WhiteRow key={w.id}>
                <Avatar person={w.author} size={32} />
                <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 6 }}>
                  <span className="truncate" style={{ fontFamily: SERIF, fontSize: 16, lineHeight: '22px', color: INK }}>
                    {w.title}
                  </span>
                  <span className="block overflow-hidden rounded-full" style={{ height: 3, background: '#ECE8E3' }}>
                    <span className="block h-full rounded-full" style={{ width: `${[72, 35, 90, 15, 50][i]}%`, background: INK }} />
                  </span>
                </div>
              </WhiteRow>
            ))}
          </div>
        </>
      )}
      {tab === 'write' && (
        <>
          <ScreenTitle>New story</ScreenTitle>
          <div style={{ background: '#FFFFFF', borderRadius: 4, padding: 16, boxShadow: '0 0 40px rgba(100,95,91,0.05)' }}>
            <div style={{ fontFamily: SERIF, fontSize: 22, lineHeight: '28px', color: 'rgba(42,36,31,0.35)' }}>Untitled</div>
            <div style={{ ...PROSE_STYLE, color: 'rgba(42,36,31,0.35)', marginTop: 12, minHeight: 200 }}>
              Start writing — a drabble, a chapter, or a chat AU.
            </div>
          </div>
          <div className="flex justify-end" style={{ marginTop: 16 }}>
            <span style={{ ...sans(14, 20, 600, '#FFFFFF'), background: INK, borderRadius: 4, padding: '10px 16px' }}>
              Start writing
            </span>
          </div>
        </>
      )}
      {tab === 'notifications' && (
        <>
          <ScreenTitle>Notifications</ScreenTitle>
          <div className="flex flex-col" style={{ gap: 8 }}>
            {[
              { who: hak2002, what: 'commented on The Door in the Floor', when: '2m' },
              { who: yeonnie, what: 'liked Trainee Room 4B', when: '14m' },
              { who: minhyukfilms, what: 'posted chapter 3 of Encore Season', when: '1h' },
              { who: starlitsoo, what: 'started following you', when: '3h' },
              { who: bridgeverse, what: 'replied to your comment', when: '1d' },
            ].map((n, i) => (
              <WhiteRow key={i}>
                <Avatar person={n.who} size={32} />
                <span className="min-w-0 flex-1" style={sans(14, 20, 400, MUTED)}>
                  <span style={{ fontWeight: 590, color: INK }}>{n.who.name}</span> {n.what}
                </span>
                <span style={sans(12, 16, 400, MUTED)}>{n.when}</span>
              </WhiteRow>
            ))}
          </div>
        </>
      )}
      {tab === 'search' && (
        <>
          <div
            className="flex items-center"
            style={{
              ...sans(14, 20, 400, MUTED),
              background: '#FFFFFF',
              border: '1px solid rgba(42,36,31,0.1)',
              borderRadius: 4,
              padding: '10px 12px',
              marginBottom: 16,
            }}
          >
            Search stories, authors, tags
          </div>
          <div style={{ ...sans(12, 16, 600, MUTED), textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            Trending tags
          </div>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {['jaehyun x minhyuk', 'slow burn', 'chat au', 'omega', 'hurt/comfort', 'idol au', 'magical realism'].map((t) => (
              <span key={t} style={{ ...sans(14, 20, 400, MUTED), textDecorationLine: 'underline', textUnderlineOffset: 3 }}>
                {t}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const NAV_ITEMS: { tab: Tab; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }> }[] = [
  { tab: 'discover', label: 'Discover', icon: Compass },
  { tab: 'library', label: 'Library', icon: Bookmark },
  { tab: 'write', label: 'Write', icon: PenLine },
  { tab: 'notifications', label: 'Notifications', icon: Bell },
  { tab: 'search', label: 'Search', icon: Library },
]

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-40"
      style={{
        height: NAV_HEIGHT_CSS,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(255,255,255,0.95)',
        borderTop: '1px solid rgba(42,36,31,0.1)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-between" style={{ height: NAV_H, padding: '10px 16px' }}>
        {NAV_ITEMS.map(({ tab: t, label, icon: Icon }) =>
          t === 'write' ? (
            <button
              key={t}
              type="button"
              aria-label={label}
              onClick={() => onChange(t)}
              className="flex items-center justify-center"
              style={{
                width: 64,
                height: 36,
                background: INK,
                borderRadius: 4,
                boxShadow: '0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)',
              }}
            >
              <Icon size={16} strokeWidth={2} color="#FFFFFF" />
            </button>
          ) : (
            <button
              key={t}
              type="button"
              aria-label={label}
              onClick={() => onChange(t)}
              className="flex items-center justify-center"
              style={{ width: 64, height: 28 }}
            >
              <Icon size={20} strokeWidth={t === 'discover' ? 2 : 1.75} color={tab === t ? INK : MUTED} />
            </button>
          ),
        )}
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReelsFeedV2() {
  const [feed, setFeed] = useState<'forYou' | 'following'>('forYou')
  const [tab, setTab] = useState<Tab>('discover')
  const [commentsFor, setCommentsFor] = useState<FeedItem | null>(null)
  const [readerFor, setReaderFor] = useState<ProseItem | null>(null)
  const [profileFor, setProfileFor] = useState<Person | null>(null)
  const lastReader = useRef<ProseItem | null>(null)
  const lastProfile = useRef<Person | null>(null)
  if (readerFor) lastReader.current = readerFor
  if (profileFor) lastProfile.current = profileFor

  const [columnRef, column] = useElementSize<HTMLDivElement>()
  const [scrollerSizeRef, scroller] = useElementSize<HTMLDivElement>()
  const scrollEl = useRef<HTMLDivElement | null>(null)
  const setScroller = useCallback(
    (node: HTMLDivElement | null) => {
      scrollEl.current = node
      scrollerSizeRef(node)
    },
    [scrollerSizeRef],
  )

  const items = feed === 'forYou' ? FOR_YOU : FOLLOWING
  const size = Math.round(column.width * CARD_RATIO)
  const ready = size > 0 && scroller.height > 0

  const switchFeed = (next: 'forYou' | 'following') => {
    if (next === feed) return
    setFeed(next)
    scrollEl.current?.scrollTo({ top: 0 })
  }

  const changeTab = (next: Tab) => {
    if (next === 'discover' && tab === 'discover') scrollEl.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setTab(next)
  }

  return (
    <div className="fixed inset-0 flex justify-center" style={{ background: '#FFFFFF' }}>
      <style>{KEYFRAMES}</style>
      <div ref={columnRef} className="relative h-full w-full max-w-[448px] overflow-hidden" style={{ background: PAGE_BG }}>
        <div
          ref={setScroller}
          className="pf-hide-scrollbar absolute inset-x-0 top-0 snap-y snap-mandatory overflow-y-auto overscroll-contain"
          style={{ bottom: NAV_HEIGHT_CSS }}
        >
          {ready &&
            items.map((item) => (
              <FeedSection
                key={`${feed}-${item.id}`}
                item={item}
                size={size}
                width={column.width}
                height={scroller.height}
                onOpenComments={setCommentsFor}
                onOpenProfile={setProfileFor}
                onOpenReader={setReaderFor}
              />
            ))}
        </div>

        {/* Feed toggle, pinned above the scrolling sections */}
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
          style={{ top: `calc(${PAD}px + env(safe-area-inset-top))` }}
        >
          <div
            className="pointer-events-auto flex items-center rounded-full"
            style={{
              height: TOGGLE_H,
              padding: 4,
              gap: 4,
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(42,36,31,0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {(
              [
                ['forYou', 'For You'],
                ['following', 'Following'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchFeed(key)}
                className="flex items-center justify-center rounded-full"
                style={{
                  height: 32,
                  padding: '6px 16px',
                  background: feed === key ? INK : 'transparent',
                  transition: 'background-color 200ms ease-out, color 200ms ease-out',
                  ...sans(14, 20, 600, feed === key ? '#FFFFFF' : MUTED),
                  letterSpacing: 0.2,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab !== 'discover' && <TabScreen tab={tab} />}

        <SidePanel open={readerFor !== null} onClose={() => setReaderFor(null)}>
          {lastReader.current && <ReaderContent item={lastReader.current} />}
        </SidePanel>
        <SidePanel open={profileFor !== null} onClose={() => setProfileFor(null)}>
          {lastProfile.current && <ProfileContent person={lastProfile.current} />}
        </SidePanel>

        <BottomNav tab={tab} onChange={changeTab} />
        <CommentSheet item={commentsFor} onClose={() => setCommentsFor(null)} />
      </div>
    </div>
  )
}
