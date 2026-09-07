import { useState, type ReactNode } from 'react'
import { UserLink } from '@/components/user-link'
import { useComments } from '@/hooks/use-comments'
import { useUser } from '@/hooks/use-user'
import { useAuthPrompt } from '@/context/auth-prompt'
import { formatRelativeTime } from '@/lib/format'
import type { Comment, CommentAuthor } from '@/lib/types'

const inputCls =
  'w-full rounded-md border border-ink/15 bg-paper px-3 py-2 font-sans text-sm outline-none focus:border-ink/40 dark:border-white/15 dark:bg-surface-night'

function Byline({ author, createdAt }: { author: CommentAuthor; createdAt: number }) {
  return (
    <p className="font-sans text-xs">
      <UserLink
        handle={author.handle}
        name={author.name}
        avatarColor={author.avatarColor}
        showAvatar={false}
        className="font-medium text-ink dark:text-stone-200"
      />
      <span className="text-ink-soft dark:text-stone-400"> · {formatRelativeTime(createdAt)}</span>
    </p>
  )
}

function CommentItem({
  comment,
  onReply,
}: {
  comment: Comment
  onReply: (commentId: string, body: string) => void
}) {
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')
  const { isGuest, promptAuth } = useAuthPrompt()

  return (
    <li className="flex gap-2.5">
      <UserLink
        handle={comment.author.handle}
        name={comment.author.name}
        avatarColor={comment.author.avatarColor}
        size={28}
        showName={false}
      />
      <div className="min-w-0 flex-1">
        <Byline author={comment.author} createdAt={comment.createdAt} />
        <p className="mt-1 whitespace-pre-wrap font-sans text-sm text-ink dark:text-stone-200">
          {comment.body}
        </p>
        <button
          type="button"
          onClick={() =>
            isGuest ? promptAuth({ action: 'reply' }) : setReplying((v) => !v)
          }
          className="mt-1 font-sans text-xs font-medium text-ink-soft hover:text-ink dark:text-stone-400 dark:hover:text-stone-200"
        >
          Reply
        </button>

        {comment.replies.length > 0 && (
          <ul className="mt-3 space-y-3 border-l border-ink/10 pl-3 dark:border-white/10">
            {comment.replies.map((r) => (
              <li key={r.id} className="flex gap-2">
                <UserLink
                  handle={r.author.handle}
                  name={r.author.name}
                  avatarColor={r.author.avatarColor}
                  size={22}
                  showName={false}
                />
                <div className="min-w-0 flex-1">
                  <Byline author={r.author} createdAt={r.createdAt} />
                  <p className="mt-1 whitespace-pre-wrap font-sans text-sm text-ink dark:text-stone-200">
                    {r.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {replying && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!text.trim()) return
              onReply(comment.id, text)
              setText('')
              setReplying(false)
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Reply…"
              className={inputCls}
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="shrink-0 bg-ink px-3 py-2 font-sans text-sm font-medium text-paper disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900"
            >
              Reply
            </button>
          </form>
        )}
      </div>
    </li>
  )
}

export function CommentThread({
  anchor,
  quote,
  likeSlot,
}: {
  anchor: string
  quote?: string
  likeSlot?: ReactNode
}) {
  const { list, addComment, addReply } = useComments()
  const { user } = useUser()
  const { isGuest, promptAuth } = useAuthPrompt()
  const [text, setText] = useState('')
  const comments = list(anchor)

  return (
    <div>
      {quote && (
        <blockquote className="border-l-2 border-ink/25 pl-3 font-serif text-sm leading-[1.6] text-ink-soft dark:border-white/25 dark:text-stone-400">
          {quote}
        </blockquote>
      )}

      {likeSlot && <div className="mt-3">{likeSlot}</div>}

      <ul className="mt-4 space-y-4">
        {comments.length === 0 ? (
          <li className="font-sans text-sm text-ink-soft dark:text-stone-400">
            No comments yet — start the conversation.
          </li>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onReply={(id, body) => addReply(anchor, id, body)}
            />
          ))
        )}
      </ul>

      {isGuest ? (
        <button
          type="button"
          onClick={() => promptAuth({ action: 'comment' })}
          className="mt-4 w-full rounded-md border border-ink/20 py-2.5 font-sans text-sm font-medium text-ink-soft hover:bg-ink/5 hover:text-ink dark:border-white/20 dark:text-stone-400 dark:hover:bg-white/5"
        >
          Sign in to comment
        </button>
      ) : (
        <form
          className="mt-4 flex items-start gap-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            addComment(anchor, text)
            setText('')
          }}
        >
          <UserLink
            handle={user.username}
            name={user.displayName}
            avatarColor={user.avatarColor}
            size={28}
            showName={false}
          />
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            className={`${inputCls} min-h-10 flex-1 resize-y`}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="shrink-0 bg-ink px-4 py-2 font-sans text-sm font-medium text-paper disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900"
          >
            Post
          </button>
        </form>
      )}
    </div>
  )
}
