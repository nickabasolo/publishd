// "Now" is pinned so the prototype's relative times stay stable across sessions.
const NOW = new Date('2026-09-06T09:00:00Z').getTime()

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
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

// 394 -> "394", 1090 -> "1.09k", 38700 -> "38.7k", 1_240_000 -> "1.24M"
export function formatCompact(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${+(n / 1000).toPrecision(3)}k`
  return `${+(n / 1_000_000).toPrecision(3)}M`
}
