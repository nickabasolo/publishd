import type { Page, PageParams } from '../types'

const DEFAULT_LIMIT = 20

// The exact PostgrestFilterBuilder generic signature varies across
// supabase-js/postgrest-js versions and is awkward to name precisely from
// call sites that build up different embedded-select shapes. `Thenable`
// captures the one thing every query builder we pass here actually needs:
// awaiting it yields `{ data, error }`, and it exposes `.range()`.
interface RangeableQuery<Row> extends PromiseLike<{ data: Row[] | null; error: { message: string } | null }> {
  range(from: number, to: number): this
}

/**
 * Offset-based cursor pagination pushed down to Postgres via `.range()`.
 * Unlike the local adapter's `paginate()` (which slices an in-memory array
 * because the local client has no database), this issues a real ranged
 * query — the extra row it fetches (`limit + 1`) is how it knows whether a
 * `nextCursor` should exist, without a second `count` round trip.
 */
export async function fetchPage<Row>(
  builder: RangeableQuery<Row>,
  params?: PageParams,
): Promise<{ rows: Row[]; nextCursor: string | null }> {
  const limit = params?.limit ?? DEFAULT_LIMIT
  const offset = decodeOffset(params?.cursor)
  const { data, error } = await builder.range(offset, offset + limit) // fetch one extra row
  if (error) throw error
  const rows = data ?? []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? String(offset + limit) : null
  return { rows: page, nextCursor }
}

export function decodeOffset(cursor?: string | null): number {
  const n = cursor ? Number(cursor) : 0
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function emptyPage<T>(): Page<T> {
  return { items: [], nextCursor: null }
}
