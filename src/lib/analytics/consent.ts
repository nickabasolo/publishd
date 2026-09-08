// Consent flag for PostHog. localStorage, not a cookie — there's no reason
// to set a cookie just to ask permission to set cookies. Shown once per
// browser; gates analytics events and error tracking together (see the
// plan: no separate error-tracking vendor, so declining means errors go
// unreported until the visitor opts in).
const STORAGE_KEY = 'publishd:analytics-consent'

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
