import { useState } from 'react'
import { api, ApiError } from '../api/client'

interface Props {
  conversationId: string
  parentCommentId?: number | null
  onClose: () => void
  onReplied: () => void
  placeholder?: string
}

export function ReplyComposer({ conversationId, parentCommentId, onClose, onReplied, placeholder }: Props) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      await api.comment(conversationId, {
        content: trimmed,
        parent_comment_id: parentCommentId,
      })
      setContent('')
      onReplied()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}: ${err.message}` : 'Failed to reply')
      setSubmitting(false)
    }
  }

  return (
    <form className="reply-composer" onSubmit={handleSubmit}>
      <textarea
        className="reply-textarea"
        rows={3}
        placeholder={placeholder ?? "Write a reply..."}
        value={content}
        onChange={e => setContent(e.target.value)}
        autoFocus
      />
      <div className="reply-actions">
        <button
          type="submit"
          className="btn-primary"
          style={{ minWidth: 80, padding: '8px 14px', fontSize: '0.8rem' }}
          disabled={submitting || !content.trim()}
        >
          {submitting ? 'Sending...' : 'Reply'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onClose}
          style={{ padding: '8px 14px' }}
        >
          Cancel
        </button>
        {error && <span className="reply-error">{error}</span>}
      </div>
    </form>
  )
}
