import { Link } from 'react-router-dom'
import type { ConversationSummary } from '../api/types'
import { StatusBadge } from './StatusBadge'
import { formatRelative } from '../lib/formatTime'
import { topicTitle } from '../lib/topicTitle'

export function ConversationCard({ conv }: { conv: ConversationSummary }) {
  return (
    <Link to={`/c/${conv.conversation_id}`} className="conversation-card">
      <h3>{topicTitle(conv.topic)}</h3>
      <div className="conversation-card-meta">
        <StatusBadge status={conv.status} />
        <span>{conv.agent_count} agents</span>
        <span>{conv.round_count} rounds</span>
        <span>▲ {conv.score}</span>
        <span>{formatRelative(conv.created_at)}</span>
      </div>
    </Link>
  )
}
