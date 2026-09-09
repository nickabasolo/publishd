// BrowserRouter for clean URLs (/story/482910). Deep links + refreshes on
// static hosts (GitHub Pages) are handled by the 404.html redirect trick;
// Vercel handles them via vercel.json rewrites.
import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/layout'
import { AccountProvider } from '@/context/account'
import { AuthPromptProvider } from '@/context/auth-prompt'
import { SettingsProvider } from '@/context/settings'
import { DataClientProvider } from '@/lib/data'
import { ConsentBanner } from '@/components/consent-banner'
import { OnboardingDialog } from '@/components/onboarding-dialog'
import { ErrorBoundary } from '@/components/error-boundary'
import { initAnalytics } from '@/lib/analytics/posthog'
import { installGlobalErrorTracking } from '@/lib/analytics/error-tracking'
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

// Dev-only UI/UX sandbox route. import.meta.env.DEV is statically
// analyzable by Vite/Rollup, so this whole branch — including the lazy
// import of the playground module and its fixtures — is dead-code-eliminated
// out of `npm run build` (production) entirely, not merely hidden by a
// runtime route guard.
const PlaygroundRoute = import.meta.env.DEV
  ? lazy(() => import('@/playground/index').then((m) => ({ default: m.PlaygroundIndexPage })))
  : null

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
  useEffect(() => {
    initAnalytics()
    installGlobalErrorTracking()
  }, [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <DataClientProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <SettingsProvider>
            <AccountProvider>
              <AuthPromptProvider>
                <ConsentBanner />
                <OnboardingDialog />
                <Routes>
                  <Route element={<Layout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/likes" element={<Navigate to="/library" replace />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/read/:publicId/:chapterNumber?" element={<ReadPage />} />
                    <Route path="/s/:publicId" element={<StoryPage />} />
                    <Route path="/t/:tag" element={<TagPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/u/:handle" element={<ProfilePage />} />
                    <Route path="/studio" element={<StudioPage />} />
                    <Route path="/studio/:slug" element={<StoryManagerPage />} />
                    <Route path="/studio/:slug/analytics" element={<StoryAnalyticsPage />} />
                    <Route path="/studio/:slug/:chapterId" element={<ChapterEditorPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    {PlaygroundRoute && (
                      <Route
                        path="/playground/*"
                        element={
                          <Suspense fallback={null}>
                            <PlaygroundRoute />
                          </Suspense>
                        }
                      />
                    )}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </AuthPromptProvider>
            </AccountProvider>
          </SettingsProvider>
        </BrowserRouter>
      </DataClientProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
