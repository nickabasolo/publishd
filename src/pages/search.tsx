import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import { TagLink } from '@/components/tag-link'
import { allTags, stories } from '@/data'
import { analytics } from '@/lib/analytics/events'

export function SearchPage() {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const lastLogged = useRef<string | null>(null)

  const results = useMemo(() => {
    if (!query) return []
    return stories.filter((s) =>
      [s.title, s.author.name, s.author.handle, s.blurb, ...s.tags]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [query])

  // Log once per settled query, not on every keystroke's re-render.
  useEffect(() => {
    if (!query || lastLogged.current === query) return
    const id = window.setTimeout(() => {
      lastLogged.current = query
      analytics.searchPerformed(query, results.length)
    }, 400)
    return () => window.clearTimeout(id)
  }, [query, results.length])

  const popular = allTags().slice(0, 12)

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 pb-32 pt-10 md:pb-24">
      <div className="flex items-center gap-2 rounded-md border border-ink/15 bg-paper px-3 dark:border-white/15 dark:bg-night">
        <SearchIcon className="h-4 w-4 shrink-0 text-ink-soft" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search stories, authors, tags"
          className="w-full bg-transparent py-2.5 font-sans text-sm outline-none"
        />
      </div>

      {query ? (
        results.length === 0 ? (
          <p className="mt-6 font-sans text-sm text-ink-soft dark:text-stone-400">
            Nothing matches &ldquo;{q.trim()}&rdquo;.
          </p>
        ) : (
          <ul className="mt-4 space-y-1">
            {results.map((s, i) => (
              <li key={s.id}>
                <Link
                  to={`/s/${s.slug}`}
                  state={{ source: 'search' }}
                  onClick={() => analytics.searchResultClicked(i, results.length)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <span
                    className="h-9 w-1.5 shrink-0 rounded"
                    style={{ backgroundColor: s.coverColor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-base text-ink dark:text-stone-100">
                      {s.title}
                    </span>
                    <span className="block truncate font-sans text-sm text-ink-soft dark:text-stone-400">
                      @{s.author.handle} · {s.tags.slice(0, 3).join(', ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="mt-6">
          <p className="font-sans text-sm font-semibold">Popular tags</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {popular.map(({ tag }) => (
              <TagLink key={tag} tag={tag} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
