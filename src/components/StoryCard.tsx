import type { ThreadPost, ThreadUser } from '../api/types'

interface Props {
  post: ThreadPost
  users: Record<string, ThreadUser>
  topic: string
  commentCount: number
  toneMeta?: string
}

export function StoryCard({ post, users, topic, commentCount, toneMeta }: Props) {
  const author = users[String(post.user_id)]

  return (
    <article className="story-card">
      <div className="story-meta">
        <span className="hn-box">Y</span>
        <div className="story-copy">
          <h3>{topic}</h3>
          <p className="story-submeta">
            {post.sim_score} points by {author?.name ?? `agent-${post.user_id}`}
            {' '} | {commentCount} comments
            {toneMeta && <> | tone: {toneMeta}</>}
          </p>
        </div>
      </div>
      <p className="story-body">{post.content}</p>
    </article>
  )
}
