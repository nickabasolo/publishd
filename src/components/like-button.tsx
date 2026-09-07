import { useState, type CSSProperties } from 'react'
import { Heart } from 'lucide-react'
import { formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

interface LikeButtonProps {
  liked: boolean
  count: number
  onToggle: () => void
  className?: string
}

const SPARKS = [0, 60, 120, 180, 240, 300]

export function LikeButton({ liked, count, onToggle, className }: LikeButtonProps) {
  // Bumped each time we transition into the liked state; re-keys the animation nodes.
  const [burst, setBurst] = useState(0)

  const handle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!liked) setBurst((b) => b + 1)
    onToggle()
  }

  const shown = count + (liked ? 1 : 0)

  return (
    <button
      type="button"
      onClick={handle}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      className={cn(
        'like-anim flex items-center gap-1 transition-colors',
        liked ? 'text-rose-500' : 'hover:text-rose-500',
        className,
      )}
    >
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
        <Heart
          key={burst}
          className={cn('h-3.5 w-3.5', liked && 'fill-current')}
          strokeWidth={1.5}
          style={burst ? { animation: 'like-pop 0.4s ease-out' } : undefined}
        />
        {burst > 0 && (
          <>
            <span
              key={`ring-${burst}`}
              className="pointer-events-none absolute inset-0 rounded-full border border-rose-400"
              style={{ animation: 'like-ring 0.5s ease-out forwards' }}
            />
            {SPARKS.map((a) => (
              <span
                key={`spark-${burst}-${a}`}
                className="pointer-events-none absolute left-1/2 top-1/2 -ml-[2px] -mt-[2px] h-1 w-1 rounded-full bg-rose-400"
                style={
                  { '--a': `${a}deg`, animation: 'like-spark 0.5s ease-out forwards' } as CSSProperties
                }
              />
            ))}
          </>
        )}
      </span>
      {formatCompact(shown)}
    </button>
  )
}
