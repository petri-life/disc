import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { ToneSlider } from './ToneSlider'

export function Composer() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState(50)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      })
      navigate(`/c/${res.conversation_id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError('Credit limit reached.')
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
      <div className="composer-lower">
        <ToneSlider value={tone} onChange={setTone} />
        <div className="action-row">
          <button className="btn-primary" type="submit" disabled={submitting || !topic.trim()}>
            {submitting ? (
              <>
                <span className="spinner spinner-inline" /> Starting...
              </>
            ) : (
              'Generate discussion'
            )}
          </button>
        </div>
      </div>
      {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
    </form>
  )
}
