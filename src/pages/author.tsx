import { PenLine, CalendarClock, Lock, LineChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const SECTIONS = [
  {
    id: 'dashboard',
    icon: PenLine,
    title: 'Draft & publish chapters',
    body: 'Write in a focused editor, save drafts, and push chapters live when they are ready.',
  },
  {
    id: 'stories',
    icon: CalendarClock,
    title: 'Schedule serialized releases',
    body: 'Queue chapters to drop on a cadence so readers always have something to come back to.',
  },
  {
    id: 'stories-paywall',
    icon: Lock,
    title: 'Manage the paywall',
    body: 'Mark which chapters are free and which are premium, and preview the reader-side lock.',
  },
  {
    id: 'analytics',
    icon: LineChart,
    title: 'See what readers do',
    body: 'Track reads, drop-off by chapter, and subscriber growth over time.',
  },
]

export function AuthorStubPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="text-center">
        <Badge variant="outline" className="mb-3">Coming next</Badge>
        <h1 className="font-sans text-3xl font-semibold tracking-[-0.15px]">Author tools</h1>
        <p className="mx-auto mt-2 max-w-md font-sans text-sm text-ink-soft dark:text-stone-400">
          The author experience is the focus of the next pass. Here is what it will cover.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.id} id={s.id} className="scroll-mt-20">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <span className="flex h-9 w-9 items-center justify-center bg-ink/[0.06] dark:bg-white/10">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <CardTitle className="text-lg">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="font-sans text-sm text-ink-soft dark:text-stone-400">
                {s.body}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
