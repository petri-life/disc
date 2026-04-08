import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useToken } from '../api/token'
import type { ConversationSummary } from '../api/types'
import { ConversationCard } from '../components/ConversationCard'

type SortMode = 'recent' | 'popular'

export function Browse() {
  const { loading: tokenLoading } = useToken()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('recent')

  useEffect(() => {
    document.title = 'Browse — Petri Disc'
  }, [])

  useEffect(() => {
    if (tokenLoading) return

    api.listConversations()
      .then(list => {
        setConversations(list)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [tokenLoading])

  const sorted = [...conversations].sort((a, b) => {
    if (sort === 'popular') return b.score - a.score
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <section className="panel">
      <div className="browse-header">
        <h2>Discussions</h2>
        <div className="browse-sort">
          <button
            className={`btn-secondary${sort === 'recent' ? ' active' : ''}`}
            onClick={() => setSort('recent')}
          >
            Recent
          </button>
          <button
            className={`btn-secondary${sort === 'popular' ? ' active' : ''}`}
            onClick={() => setSort('popular')}
          >
            Popular
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      )}

      {error && <div className="error-box" style={{ marginTop: 16 }}>{error}</div>}

      {!loading && !error && sorted.length === 0 && (
        <div className="empty-state">
          <p>No discussions yet.</p>
          <Link to="/" className="btn-primary" style={{ display: 'inline-block' }}>
            Start the first one
          </Link>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="browse-grid">
          {sorted.map(conv => (
            <ConversationCard key={conv.conversation_id} conv={conv} />
          ))}
        </div>
      )}
    </section>
  )
}
