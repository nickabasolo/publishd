// Real Supabase auth: OAuth sign-in, sign-out, and a session subscription
// that src/context/account.tsx uses to derive the app's account state when
// VITE_DATA_BACKEND=supabase. Apple is intentionally not in this union — the
// human has no Apple developer account yet, so that button stays disabled in
// the UI (see src/components/auth-sheet.tsx).
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase-browser'

export type OAuthProvider = 'google' | 'discord'

export async function signInWithOAuth(provider: OAuthProvider): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    // BASE_URL is Vite's configured base path (e.g. "/" on Vercel, "/publishd/"
    // on GitHub Pages). Under BrowserRouter the app is mounted with that same
    // value as its router basename, so the OAuth redirect must land there too
    // — landing at the bare origin would fall outside the basename on GitHub
    // Pages and fail to match any route.
    options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
  })
  if (error) throw error
  // No further action here: signInWithOAuth navigates the browser away to
  // the provider's consent screen and back. The session listener below
  // picks up the resulting session on return.
}

/**
 * Email magic-link sign-in. No password, no separate reset flow — Supabase
 * emails a one-time link that lands back on `emailRedirectTo` and creates a
 * session, picked up by the same onAuthStateChange listener OAuth uses
 * (src/context/account.tsx). Uses the same BASE_URL-aware redirect target as
 * signInWithOAuth above so it resolves correctly on both GitHub Pages'
 * /publishd/ subpath and Vercel's root.
 *
 * Not passing `type` defaults to Supabase's 'magiclink' flow (as opposed to
 * `type: 'email'` OTP-code flow), which is what we want here.
 */
export async function signInWithMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/** Fires immediately with the current session, then on every auth change. Returns an unsubscribe fn. */
export function onAuthStateChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session))
  return () => data.subscription.unsubscribe()
}
