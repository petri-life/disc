import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'
import type { ThreadResponse } from '../api/types'
import { StatusBadge } from '../components/StatusBadge'
import { ProgressFeed } from '../components/ProgressFeed'
import { ThreadView } from '../components/ThreadView'
import { SimControls } from '../components/SimControls'
import { topicTitle } from '../lib/topicTitle'
import { formatRelative } from '../lib/formatTime'

const ACTIVE_STATUSES = new Set(['queued', 'running', 'pausing'])
const THREAD_POLL_INTERVAL = 5000

export function Conversation() {
  const { id } = useParams<{ id: string }>()
  const { conversation, messages, error, loading } = usePolling(id)
  const [thread, setThread] = useState<ThreadResponse | null>(null)
  const [threadError, setThreadError] = useState<string | null>(null)
  const threadTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const isActive = conversation && ACTIVE_STATUSES.has(conversation.status)
  const isPaused = conversation?.status === 'paused'
  const title = conversation ? topicTitle(conversation.topic) : ''

  const fetchThread = useCallback(async () => {
    if (!id) return
    try {
      const data = await api.getThread(id)
      setThread(data)
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 202) return
      setThreadError((err as Error).message)
    }
  }, [id])

  // Poll thread while running, fetch once more when done/paused
  useEffect(() => {
    if (!id || !conversation) return
    if (conversation.status === 'queued' || conversation.status === 'failed') return

    let cancelled = false

    const poll = async () => {
      await fetchThread()
      if (!cancelled && isActive) {
        threadTimerRef.current = setTimeout(poll, THREAD_POLL_INTERVAL)
      }
    }

    poll()

    return () => {
      cancelled = true
      if (threadTimerRef.current) clearTimeout(threadTimerRef.current)
    }
  }, [id, conversation?.status, isActive, fetchThread])

  useEffect(() => {
    if (title) {
      document.title = `${title} — Petri Disc`
    }
  }, [title])

  if (loading) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--muted)' }}>Loading conversation...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <div className="error-box">{error}</div>
        <div style={{ marginTop: 16 }}>
          <Link to="/" className="btn-secondary">Back to home</Link>
        </div>
      </div>
    )
  }

  if (!conversation) return null

  return (
    <>
      {/* Header */}
      <section className="panel">
        <div className="panel-intro">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <StatusBadge status={conversation.status} />
            </div>
            <h2 style={{ margin: 0 }}>{title}</h2>
            <p className="story-submeta" style={{ marginTop: 8 }}>
              {conversation.agent_count} agents · {conversation.round_count} rounds
              {conversation.created_at && <> · {formatRelative(conversation.created_at)}</>}
              {thread && <> · {(thread.comments ?? []).length} comments</>}
            </p>
          </div>
          {thread && (
            <div className="result-stats">
              <div className="stat-card">
                <strong>{(thread.comments ?? []).length}</strong>
                <span>comments</span>
              </div>
              <div className="stat-card">
                <strong>{conversation.agent_count}</strong>
                <span>agents</span>
              </div>
            </div>
          )}
        </div>

        {/* Sim controls — next round / finish */}
        {(isActive || isPaused) && (
          <SimControls
            conversationId={conversation.conversation_id}
            status={conversation.status}
            roundCount={conversation.round_count}
          />
        )}

        {isActive && messages.length > 0 && (
          <ProgressFeed messages={messages} status={conversation.status} />
        )}

        {conversation.status === 'failed' && conversation.error && (
          <div className="error-box" style={{ marginTop: 16 }}>
            {conversation.error}
          </div>
        )}
      </section>

      {/* Thread — shown live as comments arrive */}
      {thread && (thread.comments ?? []).length > 0 && (
        <section className="panel">
          <ThreadView
            thread={thread}
            conversationId={conversation.conversation_id}
            topic={title}
            agentCount={conversation.agent_count}
            roundCount={conversation.round_count}
            personaMix={conversation.persona_mix}
            createdAt={conversation.created_at}
            startedAt={conversation.started_at}
            finishedAt={conversation.finished_at}
            isLive={!!isActive}
            isPaused={isPaused}
            onReplied={fetchThread}
          />
        </section>
      )}

      {isActive && (!thread || (thread.comments ?? []).length === 0) && (
        <p className="waiting-hint">
          Simulation is running — agents are discussing. Comments will appear here as they come in.
        </p>
      )}

      {threadError && (
        <div className="panel">
          <div className="error-box">Failed to load thread: {threadError}</div>
        </div>
      )}
    </>
  )
}
