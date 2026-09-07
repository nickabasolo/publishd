import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/avatar'
import { cn } from '@/lib/utils'

interface UserLinkProps {
  handle: string
  name: string
  avatarColor: string
  size?: number
  showAvatar?: boolean
  showName?: boolean
  /** Prevent an enclosing click-through card from also firing. */
  stopPropagation?: boolean
  className?: string
}

export function UserLink({
  handle,
  name,
  avatarColor,
  size = 24,
  showAvatar = true,
  showName = true,
  stopPropagation,
  className,
}: UserLinkProps) {
  return (
    <Link
      to={`/u/${handle}`}
      onClick={stopPropagation ? (e: MouseEvent) => e.stopPropagation() : undefined}
      className={cn('inline-flex items-center gap-2 hover:underline', className)}
    >
      {showAvatar && <Avatar name={name} color={avatarColor} size={size} />}
      {showName && <span className="truncate">@{handle}</span>}
    </Link>
  )
}
