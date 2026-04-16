import { useState } from 'react'
import type { ThreadResponse } from '../api/types'
import { CommentTree } from './CommentTree'
import { ReplyComposer } from './ReplyComposer'
import { getTonePreset } from '../lib/tonePresets'

interface Props {
  thread: ThreadResponse
  conversationId: string
  topic: string
  agentCount: number
  roundCount: number
  personaMix: number
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  isLive?: boolean
  isPaused?: boolean
  onReplied?: () => void
}

export function ThreadView({
  thread, conversationId,
  personaMix, isLive, isPaused, onReplied,
}: Props) {
  const preset = getTonePreset(Math.round(personaMix * 100))
  const posts = thread.posts ?? []
  const comments = thread.comments ?? []
  const users = thread.users ?? {}
  const post = posts[0]
  const [briefOpen, setBriefOpen] = useState(false)
  const [showTopComment, setShowTopComment] = useState(false)

  const toolbarLabel = isPaused
    ? 'Paused — add comments, then continue'
    : isLive
      ? 'Live — new comments appearing'
      : `Ranked by interest · ${preset.storyTone}`

  return (
    <>
      {/* Toolbar */}
      <div className="discussion-toolbar">
        <div className={`toolbar-pill${isPaused ? ' toolbar-pill-paused' : ''}`}>
          {isLive && !isPaused && <span className="spinner spinner-inline" />}
          {toolbarLabel}
        </div>
      </div>

      {/* Post / brief — collapsible */}
      {post && (
        <details className="post-brief" open={briefOpen} onToggle={e => setBriefOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="post-brief-toggle">
            {briefOpen ? 'Hide' : 'Show'} original brief
          </summary>
          <div className="post-brief-body">{post.content}</div>
        </details>
      )}

      {/* Top-level comment composer */}
      {isPaused && !showTopComment && (
        <button
          className="btn-secondary add-comment-btn"
          onClick={() => setShowTopComment(true)}
        >
          + Add comment
        </button>
      )}
      {isPaused && showTopComment && (
        <ReplyComposer
          conversationId={conversationId}
          parentCommentId={null}
          onClose={() => setShowTopComment(false)}
          onReplied={() => { onReplied?.(); setShowTopComment(false) }}
          placeholder="Add a top-level comment — agents will see it next round..."
        />
      )}

      {/* Comments */}
      <section className="discussion-panel">
        <CommentTree
          comments={comments}
          conversationId={conversationId}
          users={users}
          isPaused={isPaused}
          onReplied={onReplied}
        />
      </section>
    </>
  )
}
