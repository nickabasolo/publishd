// Global error capture, forwarded to PostHog's error-tracking feature
// (gated by the same consent + key checks as everything else in this
// module — see posthog.ts). Covers the two error shapes React's own error
// boundary can't: uncaught exceptions outside render, and unhandled promise
// rejections. React render errors are caught separately by
// src/components/error-boundary.tsx.
import { captureException } from './posthog'

let installed = false

export function installGlobalErrorTracking(): void {
  if (installed) return
  installed = true

  window.addEventListener('error', (event) => {
    captureException(event.error ?? new Error(event.message), {
      source: 'window.onerror',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    captureException(reason, { source: 'unhandledrejection' })
  })
}
