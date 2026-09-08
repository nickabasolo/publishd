// PostHog wrapper — the project's only instrumentation vendor (product
// analytics *and* error tracking, via PostHog's own exception-capture
// feature; there is no Sentry here, see the plan's Instrumentation section).
//
// Two gates, independent of each other:
//   1. Is there a key at all? `VITE_POSTHOG_KEY` is empty until the human
//      creates a PostHog project (Phase 6 of the plan can be written but not
//      verified without one). Every function here must no-op cleanly when
//      it's empty — this is the actual state of the app today.
//   2. Has the visitor consented? See `consent.ts`. PostHog is initialized
//      with `opt_out_capturing_by_default: true`, so no events, no
//      exceptions, and no persistent cookie/localStorage id are written
//      until `grantConsent()` calls `posthog.opt_in_capturing()`. Declining
//      means errors genuinely go unreported — that's the accepted tradeoff
//      of dropping a separate error-tracking vendor, not a bug to work
//      around.
import posthog from 'posthog-js'
import { getConsent } from './consent'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com'

let initialized = false

export function isAnalyticsEnabled(): boolean {
  return Boolean(KEY)
}

/** Call once, from App.tsx. Safe to call with no key — does nothing. */
export function initAnalytics(): void {
  if (!KEY) {
    // Expected state until the human creates a PostHog project (see
    // .env.example). Not an error.
    return
  }
  if (initialized) return
  initialized = true

  posthog.init(KEY, {
    api_host: HOST,
    // Anonymous browsers (guests, and readers before their first identify())
    // never get a person profile — keeps free-tier usage down and matches
    // "person_profiles: identified_only" from the plan.
    person_profiles: 'identified_only',
    // Gate everything on explicit consent. Nothing is sent, and no
    // persistent id is written to cookie/localStorage, until opt-in.
    opt_out_capturing_by_default: true,
    // We call capture() explicitly at each taxonomy event's natural call
    // site rather than relying on autocapture/pageview heuristics.
    autocapture: false,
    capture_pageview: false,
    // PostHog's own error-tracking feature (replaces Sentry in this
    // project). Current posthog-js exposes this as an init flag plus
    // posthog.captureException(...) for manual reporting — both are wired
    // here (this flag turns on the SDK's own window.onerror/
    // unhandledrejection listeners; error-tracking.ts adds a second,
    // explicit path so a deliberately-thrown test error is guaranteed to
    // reach PostHog even if the flag's coverage ever changes upstream).
    capture_exceptions: true,
  })

  if (getConsent() === 'granted') {
    posthog.opt_in_capturing()
  }
}

/** Identify the signed-in profile. Call on auth state change only — never per-event. */
export function identifyUser(profileId: string): void {
  if (!KEY) return
  posthog.identify(profileId)
}

/** Call on sign-out so the next visitor doesn't inherit the previous identity. */
export function resetIdentity(): void {
  if (!KEY) return
  posthog.reset()
}

/**
 * Fire one taxonomy event. No-ops with no key; no-ops (via PostHog's own
 * opt-out state) without consent. Keep properties few, typed, and free of
 * email / display name / bio / comment body — see the plan's hard rule.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!KEY) return
  posthog.capture(event, properties)
}

/** Manual exception report — used by error-tracking.ts and can be called directly. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!KEY) return
  posthog.captureException(error, context)
}

export function optInCapturing(): void {
  if (!KEY) return
  posthog.opt_in_capturing()
}

export function optOutCapturing(): void {
  if (!KEY) return
  posthog.opt_out_capturing()
}
