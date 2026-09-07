import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  chapterTitle: string
  initial?: number
  onClose: () => void
  onConfirm: (at: number) => void
}

function toLocalInput(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

export function ScheduleSheet({ open, chapterTitle, initial, onClose, onConfirm }: Props) {
  const [value, setValue] = useState('')
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    setValue(toLocalInput(initial ?? Date.now() + 3 * 24 * 3600 * 1000))
    const id = requestAnimationFrame(() => setEntered(true))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, initial, onClose])

  if (!open) return null

  const ms = value ? new Date(value).getTime() : NaN

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/40 transition-opacity',
          entered ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        role="dialog"
        aria-label="Schedule release"
        className={cn(
          'absolute inset-x-0 bottom-0 mx-auto flex max-w-[420px] flex-col rounded-t-2xl bg-paper text-ink shadow-xl transition-transform duration-300 dark:bg-night dark:text-stone-200',
          entered ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3 dark:border-white/10">
          <h2 className="font-sans text-sm font-semibold">Schedule release</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink-soft hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="font-sans text-sm text-ink-soft dark:text-stone-400">
            <span className="font-serif text-ink dark:text-stone-200">{chapterTitle}</span> will
            publish automatically at:
          </p>
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 font-sans text-sm outline-none focus:border-ink/40 dark:border-white/15 dark:bg-surface-night"
          />
          <button
            type="button"
            disabled={Number.isNaN(ms)}
            onClick={() => onConfirm(ms)}
            className="w-full bg-ink px-4 py-2.5 font-sans text-sm font-medium text-paper disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
