import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { SignalStage } from '../components/SignalStage'
import { Composer } from '../components/Composer'
import { ConversationCard } from '../components/ConversationCard'
import { api } from '../api/client'
import { useToken } from '../api/token'
import type { ConversationSummary } from '../api/types'

const POLL_INTERVAL = 30_000

export function Home() {
  const { loading: tokenLoading } = useToken()
  const [popular, setPopular] = useState<ConversationSummary[]>([])
  const [initialLoad, setInitialLoad] = useState(true)
  const inflightRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    document.title = 'Petri Disc — Synthetic Discussion'
  }, [])

  useEffect(() => {
    if (tokenLoading) return

    const fetchList = async () => {
      if (inflightRef.current) return
      inflightRef.current = true
      try {
        const list = await api.listConversations()
        const sorted = list
          .filter(c => c.status !== 'failed')
          .sort((a, b) => {
            const aActive = a.status === 'running' || a.status === 'queued' ? 1 : 0
            const bActive = b.status === 'running' || b.status === 'queued' ? 1 : 0
            if (bActive !== aActive) return bActive - aActive
            return b.score - a.score
          })
          .slice(0, 10)
        setPopular(sorted)
      } catch {
        // silent
      } finally {
        inflightRef.current = false
        setInitialLoad(false)
        timerRef.current = setTimeout(fetchList, POLL_INTERVAL)
      }
    }

    fetchList()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [tokenLoading])

  const loading = tokenLoading || initialLoad

  return (
    <>
      <SignalStage />

      <section className="panel">
        <div className="panel-intro">
          <div>
            <p className="section-label">Spin dozens of agents and let them comment</p>
            <h2>What's your idea?</h2>
          </div>
        </div>
        <Composer />

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 8px' }} />
            <p style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>Loading discussions...</p>
          </div>
        )}

        {!loading && popular.length > 0 && (
          <>
            <div className="popular-divider">
              <p className="section-label">Popular discussions</p>
            </div>
            <div className="browse-grid">
              {popular.map(conv => (
                <ConversationCard key={conv.conversation_id} conv={conv} />
              ))}
            </div>
            <Link to="/browse" className="popular-more">
              More discussions &rarr;
            </Link>
          </>
        )}
      </section>
    </>
  )
}
