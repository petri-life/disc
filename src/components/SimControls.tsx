import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useToken } from '../api/token'
import { formatCents } from '../lib/formatCents'
import type { ConversationStatus } from '../api/types'

interface Props {
  conversationId: string
  status: ConversationStatus
  roundCount: number
  // Real cents billed for the last completed round (0 = none yet / unmetered).
  lastRoundCostCents: number
}

export function SimControls({ conversationId, status, roundCount, lastRoundCostCents }: Props) {
  const { email, setBalance } = useToken()
  const { pathname } = useLocation()
  const [optimistic, setOptimistic] = useState<'next' | 'finish' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isPaused = status === 'paused'
  const isRunning = status === 'running'

  // Clear optimistic when real status catches up
  if (optimistic === 'next' && isRunning) {
    setOptimistic(null)
  }
  if (optimistic === 'finish' && (status === 'done' || status === 'converged')) {
    setOptimistic(null)
  }

  const handleNext = async () => {
    setOptimistic('next')
    setError(null)
    try {
      const res = await api.next(conversationId)
      setBalance(res.balance_cents)
    } catch (err) {
      setOptimistic(null)
      if (err instanceof ApiError && err.status === 402) {
        setError(err.message || 'Insufficient balance — add credits to continue.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to start next round')
      }
    }
  }

  const handleFinish = async () => {
    setOptimistic('finish')
    setError(null)
    try {
      await api.finish(conversationId)
    } catch (err) {
      setOptimistic(null)
      setError(err instanceof ApiError ? err.message : 'Failed to finish')
    }
  }

  // While running a round
  if (isRunning || optimistic === 'next') {
    return (
      <div className="sim-controls">
        <span className="sim-controls-running">
          <span className="spinner spinner-inline" /> Running round {roundCount + 1}...
        </span>
      </div>
    )
  }

  if (optimistic === 'finish') {
    return (
      <div className="sim-controls">
        <span className="sim-controls-running">
          <span className="spinner spinner-inline" /> Finishing...
        </span>
      </div>
    )
  }

  if (!isPaused) return null

  if (!email) {
    return (
      <div className="sim-controls">
        <Link
          to={`/login?next=${encodeURIComponent(pathname)}`}
          className="btn-primary"
          style={{ minWidth: 140 }}
        >
          Sign in to continue
        </Link>
        <span className="sim-controls-hint">
          Round {roundCount} complete
          {lastRoundCostCents > 0 && ` · cost ${formatCents(lastRoundCostCents)}`}
          {' — sign in to run another round'}
        </span>
      </div>
    )
  }

  return (
    <div className="sim-controls">
      <button className="btn-primary" onClick={handleNext} style={{ minWidth: 140 }}>
        ▶ Next round
      </button>
      <button className="btn-secondary" onClick={handleFinish}>
        Finish
      </button>
      <span className="sim-controls-hint">
        Round {roundCount} complete
        {lastRoundCostCents > 0 && ` · cost ${formatCents(lastRoundCostCents)}`}
        {' — add comments or continue'}
      </span>
      {error && <span className="sim-controls-error">{error}</span>}
    </div>
  )
}
