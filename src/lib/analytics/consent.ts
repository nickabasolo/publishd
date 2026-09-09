// Consent flag for PostHog. localStorage, not a cookie — there's no reason
// to set a cookie just to ask permission to set cookies. Shown once per
// browser; gates analytics events and error tracking together (see the
// plan: no separate error-tracking vendor, so declining means errors go
// unreported until the visitor opts in).
const STORAGE_KEY = 'publishd:analytics-consent'

// Pre-launch only: the site is currently only reachable by the founders
// testing it, so the consent banner is skipped and PostHog is auto-granted
// instead of asking. FLIP THIS TO false before any real visitor can reach
// the site — the EU/UK opt-in requirement this banner exists for applies
// the moment there's a real audience, not just at public launch.
export const SKIP_CONSENT_BANNER = true

export type ConsentState = 'granted' | 'declined' | null

export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'granted' || v === 'declined' ? v : null
  } catch {
    // Private browsing / storage disabled — treat as no decision yet, and
    // let the no-op paths above handle it; don't throw.
    return null
  }
}

export function setConsent(state: 'granted' | 'declined'): void {
  try {
    localStorage.setItem(STORAGE_KEY, state)
  } catch {
    // Ignore — worst case the banner reappears next load.
  }
}
