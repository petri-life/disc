import type { ThreadComment, ThreadUser } from '../api/types'
import { buildTree } from '../lib/buildTree'
import { Comment } from './Comment'
import { useMemo, useRef } from 'react'

interface Props {
  comments: ThreadComment[]
  conversationId: string
  users: Record<string, ThreadUser>
  isPaused?: boolean
  onReplied?: () => void
}

export function CommentTree({ comments, conversationId, users, isPaused, onReplied }: Props) {
  const tree = useMemo(() => buildTree(comments ?? []), [comments])
  const seenRef = useRef(new Set<number>())

  const newIds = useMemo(() => {
    const fresh = new Set<number>()
    for (const c of comments ?? []) {
      if (!seenRef.current.has(c.comment_id)) {
        if (seenRef.current.size > 0) fresh.add(c.comment_id)
        seenRef.current.add(c.comment_id)
      }
    }
    return fresh
  }, [comments])

  if (tree.length === 0) {
    return <div className="empty-state"><p>No comments yet.</p></div>
  }

  return (
    <div className="comments-root">
      {tree.map(node => (
        <Comment
          key={node.comment_id}
          node={node}
          conversationId={conversationId}
          users={users}
          depth={0}
          isNew={newIds.has(node.comment_id)}
          isPaused={isPaused}
          onReplied={onReplied}
        />
      ))}
    </div>
  )
}
