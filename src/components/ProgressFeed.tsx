import type { ProgressEntry, ConversationStatus } from '../api/types'

interface Props {
  messages: ProgressEntry[]
  status: ConversationStatus
}

const TERMINAL = new Set(['done', 'converged', 'failed'])

export function ProgressFeed({ messages, status }: Props) {
  const stages = new Map<string, ProgressEntry[]>()
  for (const msg of messages) {
    const key = msg.stage || 'info'
    if (!stages.has(key)) stages.set(key, [])
    stages.get(key)!.push(msg)
  }

  return (
    <div className="progress-feed">
      {Array.from(stages.entries()).map(([stage, entries]) => {
        const isLastStage = messages.length > 0 && messages[messages.length - 1].stage === stage
        const isActive = isLastStage && !TERMINAL.has(status)

        return (
          <div key={stage}>
            <div className="progress-stage">
              <span className={`progress-dot${isActive ? ' active' : TERMINAL.has(status) ? ' done' : ''}`} />
              {stage}
            </div>
            {entries.map(entry => (
              <div key={entry.id} className="progress-message">
                {entry.message}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
