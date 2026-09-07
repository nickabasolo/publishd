// HashRouter so deep links + refreshes work on GitHub Pages (static host, no SPA rewrite).
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/layout'
import { AccountProvider } from '@/context/account'
import { AuthPromptProvider } from '@/context/auth-prompt'
import { SettingsProvider } from '@/context/settings'
import { DataClientProvider } from '@/lib/data'
import { HomePage } from '@/pages/home'
import { LibraryPage } from '@/pages/library'
import { NotificationsPage } from '@/pages/notifications'
import { ReadPage } from '@/pages/read'
import { StoryPage } from '@/pages/story'
import { TagPage } from '@/pages/tag'
import { SearchPage } from '@/pages/search'
import { ProfilePage } from '@/pages/profile'
import { SettingsPage } from '@/pages/settings'
import { StudioPage } from '@/pages/studio'
import { StoryManagerPage } from '@/pages/story-manager'
import { StoryAnalyticsPage } from '@/pages/story-analytics'
import { ChapterEditorPage } from '@/pages/chapter-editor'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The local adapter is instant, in-memory localStorage — there's no
      // network to be stale against, so don't refetch behind the user's back.
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DataClientProvider>
        <HashRouter>
          <SettingsProvider>
            <AccountProvider>
              <AuthPromptProvider>
                <Routes>
                  <Route element={<Layout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/likes" element={<Navigate to="/library" replace />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/read/:slug/:chapterNumber?" element={<ReadPage />} />
                    <Route path="/s/:slug" element={<StoryPage />} />
                    <Route path="/t/:tag" element={<TagPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/u/:handle" element={<ProfilePage />} />
                    <Route path="/studio" element={<StudioPage />} />
                    <Route path="/studio/:slug" element={<StoryManagerPage />} />
                    <Route path="/studio/:slug/analytics" element={<StoryAnalyticsPage />} />
                    <Route path="/studio/:slug/:chapterId" element={<ChapterEditorPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </AuthPromptProvider>
            </AccountProvider>
          </SettingsProvider>
        </HashRouter>
      </DataClientProvider>
    </QueryClientProvider>
  )
}

export default App
