// HashRouter so deep links + refreshes work on GitHub Pages (static host, no SPA rewrite).
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { PrototypeProvider } from '@/context/prototype'
import { SettingsProvider } from '@/context/settings'
import { HomePage } from '@/pages/home'
import { LikesPage } from '@/pages/likes'
import { ReadPage } from '@/pages/read'
import { SettingsPage } from '@/pages/settings'
import { AuthorStubPage } from '@/pages/author'
import './index.css'

function App() {
  return (
    <HashRouter>
      <SettingsProvider>
        <PrototypeProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/likes" element={<LikesPage />} />
              <Route path="/read/:slug/:chapterNumber?" element={<ReadPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/author" element={<AuthorStubPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </PrototypeProvider>
      </SettingsProvider>
    </HashRouter>
  )
}

export default App
