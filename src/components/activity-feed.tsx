import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, PenLine } from 'lucide-react'
import { Segmented } from '@/components/ui/segmented'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ActivityItem, ActivityKind } from '@/lib/activity'

type Filter = 'all' | 'comments' | 'likes' | 'stories'

const MATCH: Record<Filter, (k: ActivityKind) => boolean> = {
  all: () => true,
  comments: (k) => k === 'comment',
  likes: (k) => k === 'like-story' || k === 'like-passage',
  stories: (k) => k === 'publish',
}

function iconFor(k: ActivityKind) {
  if (k === 'comment') return MessageCircle
  if (k === 'publish') return PenLine
  return Heart
}

function summary(it: ActivityItem): ReactNode {
  const b = <b className="font-semibold">{it.storyTitle}</b>
  const ch = it.chapter ? ` · Ch ${it.chapter}` : ''
  switch (it.kind) {
    case 'comment':
      return it.paragraph !== undefined ? (
        <>commented on a passage in {b}{ch}</>
      ) : (
        <>commented on {b}{ch}</>
      )
    case 'like-story':
      return <>liked {b}</>
    case 'like-passage':
      return <>liked a passage in {b}{ch}</>
    case 'publish':
      return <>published {b}</>
    default:
      return null
  }
}

function hrefFor(it: ActivityItem): string {
  if (it.kind === 'publish') return `/s/${it.storyPublicId}`
  return it.chapter ? `/read/${it.storyPublicId}/${it.chapter}` : `/read/${it.storyPublicId}`
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const shown = useMemo(() => items.filter((it) => MATCH[filter](it.kind)), [items, filter])

  return (
    <div>
      <Segmented<Filter>
        aria-label="Activity filter"
        size="sm"
        options={[
          { value: 'all', label: 'All' },
          { value: 'comments', label: 'Comments' },
          { value: 'likes', label: 'Likes' },
          { value: 'stories', label: 'Stories' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {shown.length === 0 ? (
        <p className="mt-4 font-sans text-sm text-ink-soft dark:text-stone-400">Nothing here yet.</p>
      ) : (
        <ul className="mt-3 space-y-0.5">
          {shown.map((it) => {
            const Icon = iconFor(it.kind)
            const isLike = it.kind === 'like-story' || it.kind === 'like-passage'
            return (
              <li key={it.id}>
                <Link
                  to={hrefFor(it)}
                  className="flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <Icon
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      isLike ? 'text-rose-500' : 'text-ink-soft dark:text-stone-400',
                    )}
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm text-ink dark:text-stone-200">{summary(it)}</p>
                    {it.excerpt && (
                      <p className="mt-0.5 line-clamp-2 font-serif text-sm text-ink-soft dark:text-stone-400">
                        {it.excerpt}
                      </p>
                    )}
                    <p className="mt-0.5 font-sans text-xs text-ink-soft dark:text-stone-500">
                      {formatRelativeTime(it.at)}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
