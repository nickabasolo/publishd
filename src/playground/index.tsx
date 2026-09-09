// Dev-only playground index. Auto-discovers every page under
// src/playground/pages/*.tsx via Vite's import.meta.glob and lists links to
// them. Add a new experiment by dropping a file in pages/ with a default
// export — no registration needed here.
import { Suspense, lazy } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'

const pageModules = import.meta.glob<{ default: React.ComponentType }>(
  './pages/*.tsx',
)

const pages = Object.keys(pageModules)
  .map((path) => {
    const name = path.replace('./pages/', '').replace(/\.tsx$/, '')
    return { name, load: pageModules[path] }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

function PlaygroundHome() {
  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-4 font-serif text-2xl text-ink dark:text-stone-100">Playground</h1>
      {pages.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-stone-400">
          No pages yet — add a file under src/playground/pages/.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pages.map((p) => (
            <li key={p.name}>
              <Link
                to={`/playground/${p.name}`}
                className="text-sm text-ink underline underline-offset-2 hover:text-ink-soft dark:text-stone-200"
              >
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PlaygroundPage() {
  const { pageName } = useParams<{ pageName: string }>()
  const entry = pages.find((p) => p.name === pageName)

  if (!entry) {
    return (
      <div className="mx-auto max-w-lg px-6 py-10">
        <p className="text-sm text-ink-soft dark:text-stone-400">
          No playground page named "{pageName}".{' '}
          <Link to="/playground" className="underline underline-offset-2">
            Back to index
          </Link>
        </p>
      </div>
    )
  }

  const Page = lazy(entry.load as () => Promise<{ default: React.ComponentType }>)
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  )
}

export function PlaygroundIndexPage() {
  return (
    <Routes>
      <Route index element={<PlaygroundHome />} />
      <Route path=":pageName" element={<PlaygroundPage />} />
    </Routes>
  )
}
