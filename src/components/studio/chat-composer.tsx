import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { ChatParticipants, ChatSpeaker } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  speaker: ChatSpeaker
  text: string
}

interface Props {
  messages: ChatMessage[]
  participants: ChatParticipants
  onChange: (messages: ChatMessage[]) => void
}

export function ChatComposer({ messages, participants, onChange }: Props) {
  const update = (index: number, patch: Partial<ChatMessage>) =>
    onChange(messages.map((m, i) => (i === index ? { ...m, ...patch } : m)))

  const remove = (index: number) => onChange(messages.filter((_, i) => i !== index))

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= messages.length) return
    const next = [...messages]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const addMessage = () => {
    const last = messages[messages.length - 1]
    const speaker: ChatSpeaker = last ? (last.speaker === 'a' ? 'b' : 'a') : 'a'
    onChange([...messages, { speaker, text: '' }])
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {messages.map((m, i) => {
        const person = participants[m.speaker]
        const isB = m.speaker === 'b'
        return (
          <div
            key={i}
            className={cn('flex items-start gap-2', isB ? 'flex-row-reverse' : 'flex-row')}
          >
            <button
              type="button"
              onClick={() => update(i, { speaker: isB ? 'a' : 'b' })}
              title={`Switch to ${isB ? participants.a.name : participants.b.name}`}
              className="mt-1.5 h-6 w-6 shrink-0 rounded-full border border-ink/25 font-sans text-[10px] font-medium uppercase text-ink-soft hover:bg-ink/5 dark:border-white/20 dark:text-stone-400 dark:hover:bg-white/5"
              style={{ backgroundColor: `${person.color}22`, color: person.color, borderColor: `${person.color}55` }}
            >
              {person.name.slice(0, 1)}
            </button>

            <div
              className={cn(
                'flex max-w-[75%] flex-1 flex-col gap-1 rounded-2xl px-3 py-2',
                isB ? 'items-end' : 'items-start',
              )}
              style={{ backgroundColor: `${person.color}1a` }}
            >
              <span className="font-sans text-[11px] font-medium" style={{ color: person.color }}>
                {person.name}
              </span>
              <input
                value={m.text}
                onChange={(e) => update(i, { text: e.target.value })}
                placeholder="Message…"
                className={cn(
                  'w-full min-w-[10ch] bg-transparent font-serif text-[15px] leading-snug text-ink outline-none placeholder:text-ink-soft/50 dark:text-stone-100',
                  isB ? 'text-right' : 'text-left',
                )}
              />
            </div>

            <div className="mt-1 flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-ink-soft hover:text-ink disabled:opacity-30 dark:text-stone-500"
                title="Move up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === messages.length - 1}
                className="text-ink-soft hover:text-ink disabled:opacity-30 dark:text-stone-500"
                title="Move down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-ink-soft hover:text-red-500 dark:text-stone-500"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={addMessage}
        className="mt-2 inline-flex w-fit items-center gap-1.5 self-start border border-ink/25 px-3 py-1.5 font-sans text-sm font-medium hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/5"
      >
        <Plus className="h-4 w-4" />
        Add message
      </button>
    </div>
  )
}
