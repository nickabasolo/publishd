// Per-key throttle for events that fire far more often than they should be
// logged — currently just `draft_saved`, which the plan calls out
// explicitly: "throttled to once a minute, not every autosave."
const lastFired = new Map<string, number>()

export function throttled(key: string, minIntervalMs: number, fn: () => void): void {
  const now = Date.now()
  const last = lastFired.get(key) ?? 0
  if (now - last < minIntervalMs) return
  lastFired.set(key, now)
  fn()
}
