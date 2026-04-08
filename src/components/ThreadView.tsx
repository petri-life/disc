import { useState } from 'react'
import type { ThreadResponse } from '../api/types'
import { CommentTree } from './CommentTree'
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
}

export function ThreadView({
  thread, conversationId,
  personaMix, isLive,
}: Props) {
  const preset = getTonePreset(Math.round(personaMix * 100))
  const post = thread.posts[0]
  const [briefOpen, setBriefOpen] = useState(false)

  return (
    <>
      {/* Toolbar */}
      <div className="discussion-toolbar">
        <div className="toolbar-pill">
          {isLive && <span className="spinner spinner-inline" />}
          {isLive ? 'Live — new comments appearing' : `Ranked by interest · ${preset.storyTone}`}
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

      {/* Comments */}
      <section className="discussion-panel">
        <CommentTree
          comments={thread.comments}
          conversationId={conversationId}
          users={thread.users}
        />
      </section>
    </>
  )
}
