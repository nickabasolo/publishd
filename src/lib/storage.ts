import { useCallback, useSyncExternalStore } from 'react'

export const KEY_PREFIX = 'publishd:'

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value))
  } catch {
    /* ignore quota / private-mode failures */
  }
}

// Module-level cache + subscribers so every useLocalStorage(key) instance stays
// in sync within the tab (and across tabs via the `storage` event).
const cache = new Map<string, unknown>()
const subscribers = new Map<string, Set<() => void>>()

function snapshot<T>(key: string, initial: T): T {
  if (!cache.has(key)) cache.set(key, read(key, initial))
  return cache.get(key) as T
}

function commit<T>(key: string, next: T): void {
  cache.set(key, next)
  write(key, next)
  subscribers.get(key)?.forEach((fn) => fn())
}

/**
 * Plain (non-hook) accessors for the `publishd:` localStorage store, for use
 * outside React — e.g. the local DataClient implementation, which is called
 * from TanStack Query rather than rendered.
 */
export function readLocal<T>(key: string, fallback: T): T {
  return snapshot(key, fallback)
}

export function writeLocal<T>(key: string, value: T): void {
  commit(key, value)
}

/**
 * Persisted, reactive state under the `publishd:` prefix. Updates from any
 * component (or another tab) propagate to every hook instance for the same key.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      let set = subscribers.get(key)
      if (!set) {
        set = new Set()
        subscribers.set(key, set)
      }
      set.add(onChange)

      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY_PREFIX + key) {
          cache.delete(key)
          onChange()
        }
      }
      window.addEventListener('storage', onStorage)

      return () => {
        set!.delete(onChange)
        window.removeEventListener('storage', onStorage)
      }
    },
    [key],
  )

  const getSnapshot = useCallback(() => snapshot(key, initial), [key, initial])
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === 'function'
          ? (next as (prev: T) => T)(snapshot(key, initial))
          : next
      commit(key, resolved)
    },
    [key, initial],
  )

  const reset = useCallback(() => commit(key, initial), [key, initial])

  return [value, setValue, reset] as const
}
