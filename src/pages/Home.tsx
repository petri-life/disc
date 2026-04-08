import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SignalStage } from '../components/SignalStage'
import { Composer } from '../components/Composer'
import { ConversationCard } from '../components/ConversationCard'
import { api } from '../api/client'
import { useToken } from '../api/token'
import type { ConversationSummary } from '../api/types'

export function Home() {
  const { loading: tokenLoading } = useToken()
  const [popular, setPopular] = useState<ConversationSummary[]>([])

  useEffect(() => {
    document.title = 'Petri Disc — Synthetic Discussion'
  }, [])

  useEffect(() => {
    if (tokenLoading) return
    api.listConversations()
      .then(list => {
        const sorted = list
          .filter(c => c.status !== 'failed')
          .sort((a, b) => {
            // Active conversations first
            const aActive = a.status === 'running' || a.status === 'queued' ? 1 : 0
            const bActive = b.status === 'running' || b.status === 'queued' ? 1 : 0
            if (bActive !== aActive) return bActive - aActive
            // Then by score
            return b.score - a.score
          })
          .slice(0, 10)
        setPopular(sorted)
      })
      .catch(() => {})
  }, [tokenLoading])

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

        {popular.length > 0 && (
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
