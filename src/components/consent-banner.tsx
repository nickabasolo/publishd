import { useState } from 'react'
import { getConsent, setConsent } from '@/lib/analytics/consent'
import { isAnalyticsEnabled, optInCapturing, optOutCapturing } from '@/lib/analytics/posthog'

/**
 * Small, dismissible cookie/analytics consent banner. Shown once per browser
 * (localStorage flag — see consent.ts). Gates PostHog entirely: accepting
 * turns on event capture and error reporting, declining leaves both off for
 * the rest of the session (and every session after, until the flag is
 * cleared). Doesn't render at all when there's no PostHog key yet — nothing
 * to consent to.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(() => isAnalyticsEnabled() && getConsent() === null)

  if (!visible) return null

  const decide = (state: 'granted' | 'declined') => {
    setConsent(state)
    if (state === 'granted') optInCapturing()
    else optOutCapturing()
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink/10 bg-paper px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-night sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm sm:rounded-xl sm:border"
    >
      <p className="font-sans text-sm text-ink dark:text-stone-200">
        We use PostHog to see what&rsquo;s working and to catch errors. It only runs if
        you say yes.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => decide('granted')}
          className="bg-ink px-3 py-1.5 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-100/90"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => decide('declined')}
          className="border border-ink/25 px-3 py-1.5 font-sans text-sm font-medium hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/5"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
