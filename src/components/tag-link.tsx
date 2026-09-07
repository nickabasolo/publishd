import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface TagLinkProps {
  tag: string
  className?: string
  /** Prevent an enclosing click-through card from also firing. */
  stopPropagation?: boolean
}

export function TagLink({ tag, className, stopPropagation }: TagLinkProps) {
  return (
    <Link
      to={`/t/${encodeURIComponent(tag)}`}
      onClick={stopPropagation ? (e: MouseEvent) => e.stopPropagation() : undefined}
      className={cn(
        'font-sans text-sm tracking-[-0.15px] text-ink-soft underline underline-offset-2 hover:text-ink dark:text-stone-400 dark:hover:text-stone-200',
        className,
      )}
    >
      {tag}
    </Link>
  )
}
