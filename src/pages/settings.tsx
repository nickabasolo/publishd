import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Segmented } from '@/components/ui/segmented'
import { Avatar } from '@/components/avatar'
import { StatTile } from '@/components/stat-tile'
import { useUser, useFakeStats } from '@/hooks/use-user'
import {
  FONT_SIZE_LABEL,
  LINE_HEIGHT_LABEL,
  useSettings,
} from '@/context/settings'
import { AVATAR_COLORS, GENRE_OPTIONS } from '@/data/default-user'
import { cn } from '@/lib/utils'
import type { FakeStats, FontSizePref, LineHeightPref, ThemePref } from '@/lib/types'

const inputCls =
  'w-full rounded-md border border-ink/15 bg-paper px-3 py-2 font-sans text-sm outline-none focus:border-ink/40 dark:border-white/15 dark:bg-surface-night dark:focus:border-white/40'

export function SettingsPage() {
  const { user, updateUser } = useUser()
  const { stats, updateStats } = useFakeStats()
  const { settings, setTheme, setFontSize, setLineHeight } = useSettings()
  const [showStatEditor, setShowStatEditor] = useState(false)

  const toggleGenre = (genre: string) => {
    const has = user.favoriteGenres.includes(genre)
    updateUser({
      favoriteGenres: has
        ? user.favoriteGenres.filter((g) => g !== genre)
        : [...user.favoriteGenres, genre],
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 pb-36 md:py-10 md:pb-24">
      <div>
        <h1 className="font-sans text-3xl font-semibold tracking-[-0.15px]">Settings</h1>
        <p className="font-sans text-sm text-ink-soft dark:text-stone-400">
          Your profile and reading experience
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Profile</CardTitle>
          <CardDescription>How you appear on Publishd</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={user.displayName} color={user.avatarColor} size={56} />
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Avatar color ${c}`}
                  onClick={() => updateUser({ avatarColor: c })}
                  className={cn(
                    'h-6 w-6 rounded-full ring-offset-2 ring-offset-paper transition dark:ring-offset-night',
                    user.avatarColor === c && 'ring-2 ring-ink dark:ring-stone-100',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 font-sans text-sm font-medium">
              <span>Display name</span>
              <input
                className={inputCls}
                value={user.displayName}
                onChange={(e) => updateUser({ displayName: e.target.value })}
              />
            </label>
            <label className="space-y-1.5 font-sans text-sm font-medium">
              <span>Username</span>
              <input
                className={inputCls}
                value={user.username}
                onChange={(e) => updateUser({ username: e.target.value.replace(/\s+/g, '') })}
              />
            </label>
          </div>

          <label className="block space-y-1.5 font-sans text-sm font-medium">
            <span>Bio</span>
            <textarea
              className={cn(inputCls, 'min-h-20 resize-y')}
              value={user.bio}
              onChange={(e) => updateUser({ bio: e.target.value })}
            />
          </label>

          <div className="space-y-2">
            <p className="font-sans text-sm font-medium">Favorite genres</p>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_OPTIONS.map((g) => {
                const active = user.favoriteGenres.includes(g)
                return (
                  <button key={g} type="button" onClick={() => toggleGenre(g)}>
                    <Badge variant={active ? 'default' : 'outline'}>{g}</Badge>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reading stats (faked) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Reading stats</CardTitle>
          <CardDescription>Illustrative figures for the prototype</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Books read" value={stats.booksRead} />
            <StatTile label="Chapters" value={stats.chaptersRead} />
            <StatTile label="Minutes" value={stats.minutesRead.toLocaleString()} />
            <StatTile label="Day streak" value={stats.dayStreak} />
          </div>

          <button
            type="button"
            onClick={() => setShowStatEditor((v) => !v)}
            className="font-sans text-sm font-medium text-ink-soft underline-offset-2 hover:underline dark:text-stone-400"
          >
            {showStatEditor ? 'Hide' : 'Adjust demo values'}
          </button>

          {showStatEditor && (
            <div className="grid gap-3 rounded-lg bg-ink/[0.03] p-3 sm:grid-cols-2 dark:bg-white/5">
              {(
                [
                  ['booksRead', 'Books read'],
                  ['chaptersRead', 'Chapters'],
                  ['minutesRead', 'Minutes'],
                  ['dayStreak', 'Day streak'],
                ] as [keyof FakeStats, string][]
              ).map(([key, label]) => (
                <label key={key} className="space-y-1 font-sans text-sm font-medium">
                  <span>{label}</span>
                  <input
                    type="number"
                    className={inputCls}
                    value={stats[key]}
                    onChange={(e) => updateStats({ [key]: Number(e.target.value) || 0 })}
                  />
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reading preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Reading preferences</CardTitle>
          <CardDescription>Applied to the story reader</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-sans text-sm font-medium">Theme</span>
            <Segmented<ThemePref>
              aria-label="Theme"
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
              value={settings.theme}
              onChange={setTheme}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-sans text-sm font-medium">Font size</span>
            <Segmented<FontSizePref>
              aria-label="Font size"
              options={(['sm', 'base', 'lg', 'xl'] as FontSizePref[]).map((v) => ({
                value: v,
                label: FONT_SIZE_LABEL[v],
              }))}
              value={settings.fontSize}
              onChange={setFontSize}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-sans text-sm font-medium">Line height</span>
            <Segmented<LineHeightPref>
              aria-label="Line height"
              options={(['tight', 'normal', 'relaxed'] as LineHeightPref[]).map((v) => ({
                value: v,
                label: LINE_HEIGHT_LABEL[v],
              }))}
              value={settings.lineHeight}
              onChange={setLineHeight}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
