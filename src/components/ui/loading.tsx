import { Loader2 } from 'lucide-react'

/**
 * Small centered loading indicator, styled consistently with the app's
 * existing empty-state cards (`rounded-xl bg-paper p-8 text-center shadow-sm`).
 * Used by pages that now fetch story/chapter content asynchronously through
 * the data contract instead of importing static JSON.
 */
export function Loading({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-paper p-8 text-ink-soft shadow-sm dark:bg-night dark:text-stone-400 ${className}`}
    >
      <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
    </div>
  )
}
