import type { ThreadComment, ThreadUser } from '../api/types'
import { buildTree } from '../lib/buildTree'
import { Comment } from './Comment'
import { useMemo } from 'react'

interface Props {
  comments: ThreadComment[]
  conversationId: string
  users: Record<string, ThreadUser>
}

export function CommentTree({ comments, conversationId, users }: Props) {
  const tree = useMemo(() => buildTree(comments), [comments])

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
        />
      ))}
    </div>
  )
}
