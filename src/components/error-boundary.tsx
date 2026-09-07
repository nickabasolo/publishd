import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureException } from '@/lib/analytics/posthog'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

/**
 * Root error boundary. Catches render-time exceptions React's own error
 * handling would otherwise just log to the console, and forwards them to
 * PostHog's error tracking (gated by consent, same as everything else —
 * see src/lib/analytics/posthog.ts). Uncaught exceptions outside render and
 * unhandled promise rejections are covered separately by
 * src/lib/analytics/error-tracking.ts.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { source: 'react-error-boundary', componentStack: info.componentStack })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="font-sans text-lg font-medium">Something went wrong.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-ink px-4 py-2 font-sans text-sm font-medium text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
