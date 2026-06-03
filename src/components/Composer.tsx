import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useToken } from '../api/token'
import { formatCents } from '../lib/formatCents'
import { ToneSlider } from './ToneSlider'
import type { Tier } from '../api/types'

// Human-facing label + tagline per tier. Server is the source of truth for
// which tiers exist; this map just adds friendly copy that the server doesn't
// know about. Unknown tiers (added server-side later) fall back to the raw name.
const TIER_LABELS: Record<string, { label: string; tagline: string }> = {
  flash:  { label: 'Fast',    tagline: 'Quick discussions, broad coverage' },
  smart:  { label: 'Smart',   tagline: 'Sharper takes, more nuance' },
  sonnet: { label: 'Premium', tagline: 'Most distinctive personas' },
}

export function Composer() {
  const navigate = useNavigate()
  const { email, setBalance } = useToken()
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState(50)
  const [tiers, setTiers] = useState<Tier[] | null>(null)
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tiers are public — fetch once on mount regardless of auth state. Default
  // selection is whatever the server marks as default (currently 'flash').
  useEffect(() => {
    let cancelled = false
    api.tiers()
      .then(res => {
        if (cancelled) return
        setTiers(res.tiers)
        setSelectedTier(res.default)
      })
      .catch(() => {
        // Tier fetch failed — leave selectedTier null, server will use its
        // default. Composer still works, just no picker UI.
      })
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = topic.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await api.createConversation({
        topic: trimmed,
        persona_mix: tone / 100,
        model: selectedTier ?? undefined,
      })
      setBalance(res.balance_cents)
      navigate(`/c/${res.conversation_id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        // 402 = insufficient balance (the server gate). 429 = concurrency cap.
        if (err.status === 402) {
          setError(err.message || 'Insufficient balance — add credits to run a round.')
        } else if (err.status === 429) {
          setError('A simulation is already running. Try again in a moment.')
        } else {
          setError(`Error ${err.status}: ${err.message}`)
        }
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="prompt-input">
        Idea or product specification
      </label>
      <textarea
        id="prompt-input"
        name="prompt"
        rows={7}
        placeholder="Paste an idea, launch post, or product specification."
        value={topic}
        onChange={e => setTopic(e.target.value)}
      />
      {tiers && tiers.length > 0 && (
        <div className="tier-picker" role="radiogroup" aria-label="Model tier">
          {tiers.map(t => {
            const meta = TIER_LABELS[t.name] ?? { label: t.name, tagline: t.model }
            const active = selectedTier === t.name
            return (
              <button
                key={t.name}
                type="button"
                role="radio"
                aria-checked={active}
                className={`tier-btn${active ? ' tier-btn-active' : ''}`}
                onClick={() => setSelectedTier(t.name)}
              >
                <span className="tier-btn-label">{meta.label}</span>
                <span className="tier-btn-tagline">{meta.tagline}</span>
                <span className="tier-btn-cost">~{formatCents(t.estimate_cents)}/round</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="composer-lower">
        <ToneSlider value={tone} onChange={setTone} />
        <div className="action-row">
          {email ? (
            <button className="btn-primary" type="submit" disabled={submitting || !topic.trim()}>
              {submitting ? (
                <>
                  <span className="spinner spinner-inline" /> Starting...
                </>
              ) : (
                'Generate discussion'
              )}
            </button>
          ) : (
            <Link to="/login?next=/" className="btn-primary">
              Sign in to generate
            </Link>
          )}
        </div>
      </div>
      {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
    </form>
  )
}
