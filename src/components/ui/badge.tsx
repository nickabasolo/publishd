import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'outline' | 'muted'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-ink text-paper dark:bg-stone-100 dark:text-stone-900',
  outline: 'border border-ink/15 text-ink-soft dark:border-white/20 dark:text-stone-400',
  muted: 'bg-ink/[0.06] text-ink-soft dark:bg-white/10 dark:text-stone-300',
}

export function Badge({
  className,
  variant = 'muted',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-sans text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
