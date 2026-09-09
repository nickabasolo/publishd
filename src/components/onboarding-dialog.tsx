import { useEffect, useRef, useState } from 'react'
import { useAccount } from '@/context/account'
import { supabase } from '@/lib/data/supabase/supabase-browser'
import { AVATAR_COLORS } from '@/data/default-user'
import { cn } from '@/lib/utils'

// Same slugification handle_new_user applies server-side (0002_profiles.sql):
// lowercase, strip anything outside [a-z0-9], collapse. This is UX only —
// the DB unique index on lower(username) is the real enforcement, and the
// save below still surfaces a unique-violation if two people race.
function slugify(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const backend = import.meta.env.VITE_DATA_BACKEND ?? 'local'

/**
 * Post-first-sign-in confirm-or-edit dialog. Prefilled with whatever
 * `handle_new_user` auto-generated (from OAuth profile data, or — for
 * magic-link signups, which have no OAuth metadata — its email/random-suffix
 * fallback). Purely optional: closing without saving leaves the
 * auto-generated values as-is, since they're already valid saved rows.
 * Either action (save or dismiss) marks `profiles.onboarded_at` so it never
 * shows again for this account. Same non-blocking, once-per-account shape as
 * ConsentBanner (src/components/consent-banner.tsx).
 *
 * Only meaningful on the supabase backend — local demo mode has no real
 * account lifecycle to onboard into.
 */
export function OnboardingDialog() {
  const { accountId } = useAccount()
  const [userId, setUserId] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const checkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const originalUsername = useRef('')

  // Look up the signed-in account's own onboarding state once per sign-in.
  useEffect(() => {
    if (backend !== 'supabase' || accountId === 'guest') {
      setVisible(false)
      setUserId(null)
      return
    }
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      if (!session || cancelled) return
      setUserId(session.user.id)
      supabase
        .from('profiles')
        .select('username, display_name, avatar_color, onboarded_at')
        .eq('id', session.user.id)
        .single()
        .then(({ data: row }) => {
          if (cancelled || !row) return
          if (row.onboarded_at) return
          setDisplayName(row.display_name ?? '')
          setUsername(row.username ?? '')
          originalUsername.current = row.username ?? ''
          setAvatarColor(row.avatar_color ?? AVATAR_COLORS[0])
          setVisible(true)
        })
    })
    return () => {
      cancelled = true
    }
  }, [accountId])

  // Debounced availability check — UX only, DB constraint is the real gate.
  useEffect(() => {
    if (!visible) return
    if (username === originalUsername.current || username.length === 0) {
      setUsernameStatus('idle')
      return
    }
    setUsernameStatus('checking')
    clearTimeout(checkTimer.current)
    checkTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 400)
    return () => clearTimeout(checkTimer.current)
  }, [username, visible])

  if (!visible || !userId) return null

  const markOnboarded = async () => {
    await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', userId)
  }

  const dismiss = async () => {
    setVisible(false)
    await markOnboarded()
  }

  const save = async () => {
    const slug = slugify(username)
    if (!slug) {
      setError('Username can only contain letters and numbers.')
      return
    }
    if (!displayName.trim()) {
      setError('Display name can’t be empty.')
      return
    }
    if (usernameStatus === 'taken') {
      setError('That username is taken.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        username: slug,
        avatar_color: avatarColor,
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', userId)
    setSaving(false)
    if (updateError) {
      setError(
        updateError.code === '23505' ? 'That username is taken.' : 'Could not save — try again.',
      )
      return
    }
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-label="Confirm your profile"
        className="w-full max-w-sm rounded-xl bg-paper p-5 text-ink shadow-xl dark:bg-night dark:text-stone-200"
      >
        <h2 className="font-sans text-lg font-semibold">Welcome to Publishd</h2>
        <p className="mt-1 font-sans text-sm text-ink-soft dark:text-stone-400">
          We set up a profile for you. Change anything now, or just close this &mdash;
          you can always edit it later in Settings.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Avatar color ${c}`}
                onClick={() => setAvatarColor(c)}
                className={cn(
                  'h-6 w-6 rounded-full ring-offset-2 ring-offset-paper transition dark:ring-offset-night',
                  avatarColor === c && 'ring-2 ring-ink dark:ring-stone-100',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <label className="block space-y-1 font-sans text-sm font-medium">
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 font-sans text-sm outline-none focus:border-ink/40 dark:border-white/15 dark:bg-surface-night dark:focus:border-white/40"
            />
          </label>

          <label className="block space-y-1 font-sans text-sm font-medium">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(slugify(e.target.value))}
              className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 font-sans text-sm outline-none focus:border-ink/40 dark:border-white/15 dark:bg-surface-night dark:focus:border-white/40"
            />
            {usernameStatus === 'checking' && (
              <span className="font-sans text-xs text-ink-soft dark:text-stone-400">Checking&hellip;</span>
            )}
            {usernameStatus === 'available' && (
              <span className="font-sans text-xs text-emerald-600 dark:text-emerald-400">Available</span>
            )}
            {usernameStatus === 'taken' && (
              <span className="font-sans text-xs text-red-600 dark:text-red-400">Already taken</span>
            )}
          </label>

          {error && <p className="font-sans text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || usernameStatus === 'checking'}
            className="bg-ink px-3 py-1.5 font-sans text-sm font-medium text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-100/90"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="border border-ink/25 px-3 py-1.5 font-sans text-sm font-medium hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/5"
          >
            Looks good
          </button>
        </div>
      </div>
    </div>
  )
}
