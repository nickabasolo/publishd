// HashRouter so deep links + refreshes work on GitHub Pages (static host, no SPA rewrite).
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { AccountProvider } from '@/context/account'
import { SettingsProvider } from '@/context/settings'
import { HomePage } from '@/pages/home'
import { LikesPage } from '@/pages/likes'
import { ReadPage } from '@/pages/read'
import { ProfilePage } from '@/pages/profile'
import { SettingsPage } from '@/pages/settings'
import { StudioPage } from '@/pages/studio'
import { StoryManagerPage } from '@/pages/story-manager'
import { ChapterEditorPage } from '@/pages/chapter-editor'
import './index.css'

function App() {
  return (
    <HashRouter>
      <SettingsProvider>
        <AccountProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/likes" element={<LikesPage />} />
              <Route path="/read/:slug/:chapterNumber?" element={<ReadPage />} />
              <Route path="/u/:handle" element={<ProfilePage />} />
              <Route path="/studio" element={<StudioPage />} />
              <Route path="/studio/:slug" element={<StoryManagerPage />} />
              <Route path="/studio/:slug/:chapterId" element={<ChapterEditorPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AccountProvider>
      </SettingsProvider>
    </HashRouter>
  )
}

export default App
