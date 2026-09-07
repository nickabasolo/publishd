// Node module-resolution hook used only by scripts/seed.mjs.
//
// The app's source under src/ uses the Vite/TS path alias "@/..." (see
// tsconfig.app.json / vite.config.ts), which plain Node has no idea about.
// Node 24 already strips TypeScript type syntax natively, so a straight
// `import('../src/data/comments-seed.ts')` works for files with no
// non-type-only imports — but src/data/accounts.ts pulls in a *value* import
// via "@/data/default-user", which needs real module resolution. This hook
// teaches Node that one alias, and nothing else: "@/x" -> "<repo>/src/x",
// trying a few common extensions since alias imports in this codebase omit
// them.
//
// Registered from seed.mjs via `node:module`'s `register()`, scoped to that
// process only. It never touches src/ itself.

import { pathToFileURL } from 'node:url'
import path from 'node:path'

const SRC_ROOT = pathToFileURL(`${path.resolve(import.meta.dirname, '..', 'src')}/`).href

const EXT_CANDIDATES = ['', '.ts', '.tsx', '/index.ts']

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rest = specifier.slice(2)
    let lastError
    for (const ext of EXT_CANDIDATES) {
      const target = new URL(rest + ext, SRC_ROOT).href
      try {
        return await nextResolve(target, context)
      } catch (err) {
        lastError = err
      }
    }
    throw lastError
  }
  return nextResolve(specifier, context)
}
