import { useState, useCallback, useMemo } from 'react'
import type { ThreadUser } from '../api/types'
import type { CommentNode } from '../lib/buildTree'
import { formatRelative } from '../lib/formatTime'
import { renderMarkdown } from '../lib/renderMarkdown'
import { api, ApiError } from '../api/client'
import { UserPopover } from './UserPopover'

interface Props {
  node: CommentNode
  conversationId: string
  users: Record<string, ThreadUser>
  depth: number
}

export function Comment({ node, conversationId, users, depth }: Props) {
  const [upvotes, setUpvotes] = useState(node.upvotes)
  const [voted, setVoted] = useState(false)
  const [showPopover, setShowPopover] = useState(false)

  const user = users[String(node.user_id)]
  const bodyHtml = useMemo(() => renderMarkdown(node.content), [node.content])

  const handleUpvote = useCallback(async () => {
    if (voted) return
    setVoted(true)
    setUpvotes(prev => prev + 1)
    try {
      const res = await api.upvote(conversationId, node.comment_id)
      setUpvotes(res.upvotes)
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setVoted(false)
        setUpvotes(node.upvotes)
      }
    }
  }, [voted, conversationId, node.comment_id, node.upvotes])

  return (
    <article className="comment" data-depth={Math.min(depth, 8)}>
      <div className="comment-card">
        <div className="comment-meta">
          <div className="comment-author">
            <button
              className={`vote-chip${voted ? ' voted' : ''}`}
              onClick={handleUpvote}
              aria-label={`Upvote (${upvotes})`}
            >
              ▲ <span>{upvotes}</span>
            </button>
            {node.sim_score !== 0 && (
              <span className="sim-score" title="Agent votes (likes − dislikes)">
                {node.sim_score > 0 ? '+' : ''}{node.sim_score} sim
              </span>
            )}
            <div style={{ position: 'relative' }}>
              <strong onClick={() => setShowPopover(v => !v)}>
                {user?.name ?? `agent-${node.user_id}`}
              </strong>
              {showPopover && user && (
                <UserPopover user={user} onClose={() => setShowPopover(false)} />
              )}
            </div>
          </div>
          <span className="comment-time">{formatRelative(node.created_at)}</span>
        </div>
        <div className="comment-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>

      {node.children.length > 0 && (
        <div className="comment-children">
          {node.children.map(child => (
            <Comment
              key={child.comment_id}
              node={child}
              conversationId={conversationId}
              users={users}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </article>
  )
}
