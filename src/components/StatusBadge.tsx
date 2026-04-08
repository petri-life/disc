import type { ConversationStatus } from '../api/types'

export function StatusBadge({ status }: { status: ConversationStatus }) {
  return <span className={`status-badge ${status}`}>{status}</span>
}
