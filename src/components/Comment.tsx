import { useState, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ThreadUser } from '../api/types'
import type { CommentNode } from '../lib/buildTree'
import { formatRelative } from '../lib/formatTime'
import { renderMarkdown } from '../lib/renderMarkdown'
import { api, ApiError } from '../api/client'
import { useToken } from '../api/token'
import { UserPopover } from './UserPopover'
import { ReplyComposer } from './ReplyComposer'

interface Props {
  node: CommentNode
  conversationId: string
  users: Record<string, ThreadUser>
  depth: number
  isNew?: boolean
  isPaused?: boolean
  onReplied?: () => void
}

export function Comment({ node, conversationId, users, depth, isNew, isPaused, onReplied }: Props) {
  const { email } = useToken()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [upvotes, setUpvotes] = useState(node.upvotes)
  const [voted, setVoted] = useState(false)
  const [showPopover, setShowPopover] = useState(false)
  const [showReply, setShowReply] = useState(false)

  const user = users[String(node.user_id)]
  const bodyHtml = useMemo(() => renderMarkdown(node.content), [node.content])

  // Send unauthenticated users to /login, preserving where they were so the
  // callback resumes here. Used by both upvote and reply.
  const goSignIn = useCallback(() => {
    navigate(`/login?next=${encodeURIComponent(pathname)}`)
  }, [navigate, pathname])

  const handleUpvote = useCallback(async () => {
    if (!email) return goSignIn()
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
  }, [email, goSignIn, voted, conversationId, node.comment_id, node.upvotes])

  const handleReplyClick = () => {
    if (!email) return goSignIn()
    setShowReply(v => !v)
  }

  return (
    <article className={`comment${isNew ? ' comment-new' : ''}`} data-depth={Math.min(depth, 8)}>
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
        {isPaused && (
          <div className="comment-actions">
            <span onClick={handleReplyClick}>{email ? 'reply' : 'sign in to reply'}</span>
          </div>
        )}
      </div>

      {showReply && (
        <ReplyComposer
          conversationId={conversationId}
          parentCommentId={node.comment_id}
          onClose={() => setShowReply(false)}
          onReplied={() => onReplied?.()}
        />
      )}

      {node.children.length > 0 && (
        <div className="comment-children">
          {node.children.map(child => (
            <Comment
              key={child.comment_id}
              node={child}
              conversationId={conversationId}
              users={users}
              depth={depth + 1}
              isPaused={isPaused}
              onReplied={onReplied}
            />
          ))}
        </div>
      )}
    </article>
  )
}
