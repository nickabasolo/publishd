import type { Page, PageParams } from '../types'

const DEFAULT_LIMIT = 20

/**
 * Genuine cursor pagination over an in-memory array. The local adapter has no
 * technical need for this — it could return everything at once — but faking
 * it here is exactly the failure mode Phase 1 exists to avoid: if the local
 * client always returns the full list, hooks and components end up assuming
 * an API shape the real backend will never provide.
 */
export function paginate<T>(items: T[], params?: PageParams): Page<T> {
  const limit = params?.limit ?? DEFAULT_LIMIT
  const start = params?.cursor ? Number(params.cursor) : 0
  const offset = Number.isFinite(start) && start >= 0 ? start : 0
  const slice = items.slice(offset, offset + limit)
  const end = offset + slice.length
  const nextCursor = end < items.length ? String(end) : null
  return { items: slice, nextCursor }
}
