import { Navigation } from '@/components/navigation'
import { PrototypeBanner } from '@/components/prototype-banner'
import { NowReadingBar } from '@/components/now-reading-bar'
import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface text-ink dark:bg-surface-night dark:text-stone-200">
      <PrototypeBanner />

      <div className="flex flex-1 overflow-hidden pt-12">
        {/* Sidebar - hidden on mobile, visible on desktop */}
        <div className="hidden md:block">
          <Navigation />
        </div>

        {/* Main content area */}
        <main className="flex-1 w-full overflow-y-auto md:ml-64">
          <Outlet />
        </main>

        <NowReadingBar />

        {/* Bottom navigation - visible on mobile only */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
          <Navigation />
        </div>
      </div>
    </div>
  )
}
