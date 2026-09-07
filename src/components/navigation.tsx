import { Home, Heart, PenLine, User } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: typeof Home
}

export function Navigation() {
  const location = useLocation()
  const { user } = useUser()

  // One nav for everyone — a reader-type account just has an empty Studio.
  const navItems: NavItem[] = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Likes', href: '/likes', icon: Heart },
    { label: 'Write', href: '/studio', icon: PenLine },
    { label: 'Profile', href: `/u/${user.username}`, icon: User },
  ]

  const isActive = (href: string) => {
    const path = href.split('#')[0]
    if (path === '/studio') return location.pathname.startsWith('/studio')
    // Profile tab is only "active" on your own profile, not someone else's.
    return location.pathname === path
  }

  return (
    <>
      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-ink/10 bg-paper md:hidden dark:border-white/10 dark:bg-night">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-label={item.label}
                className={cn(
                  'flex h-16 w-16 items-center justify-center transition-colors',
                  active ? 'text-ink dark:text-stone-100' : 'text-ink-soft dark:text-stone-500',
                )}
              >
                <Icon
                  className={cn('h-5 w-5', active && 'fill-current')}
                  strokeWidth={active ? 2 : 1.75}
                />
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop sidebar */}
      <aside className="fixed bottom-0 left-0 top-12 hidden w-64 border-r border-ink/10 bg-paper p-4 md:block dark:border-white/10 dark:bg-night">
        <div className="space-y-1">
          <h1 className="mb-8 px-3 font-wordmark text-2xl text-ink dark:text-stone-100">publishd.</h1>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 font-sans text-sm transition-colors',
                  active
                    ? 'bg-ink/[0.06] font-medium text-ink dark:bg-white/10 dark:text-stone-100'
                    : 'text-ink-soft hover:bg-ink/5 hover:text-ink dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-stone-200',
                )}
              >
                <Icon
                  className={cn('h-[18px] w-[18px]', active && 'fill-current')}
                  strokeWidth={1.75}
                />
                {item.label}
              </Link>
            )
          })}
        </div>
      </aside>
    </>
  )
}
