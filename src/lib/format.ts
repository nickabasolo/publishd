// "Now" is pinned so the prototype's relative times stay stable across sessions.
const NOW = new Date('2026-09-06T09:00:00Z').getTime()

export function formatRelativeTime(input: string | number): string {
  const then = typeof input === 'number' ? input : new Date(input).getTime()
  const mins = Math.round((NOW - then) / 60000)
  if (mins < 60) return `${Math.max(mins, 1)}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.round(days / 7)
  return `${weeks}w ago`
}

export function isRecent(iso: string, withinHours = 48): boolean {
  return NOW - new Date(iso).getTime() < withinHours * 3600 * 1000
}

// Forward-looking: "in 3d", "in 5h", "in 2w". Relative to the pinned "now".
export function formatRelativeFuture(ms: number): string {
  const delta = ms - NOW
  if (delta <= 0) return 'now'
  const mins = Math.round(delta / 60000)
  if (mins < 60) return `in ${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `in ${hours}h`
  const days = Math.round(hours / 24)
  if (days < 14) return `in ${days}d`
  const weeks = Math.round(days / 7)
  return `in ${weeks}w`
}

// 394 -> "394", 1090 -> "1.09k", 38700 -> "38.7k", 1_240_000 -> "1.24M"
export function formatCompact(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${+(n / 1000).toPrecision(3)}k`
  return `${+(n / 1_000_000).toPrecision(3)}M`
}
