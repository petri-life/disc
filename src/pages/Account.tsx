import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useToken } from '../api/token'
import { api, ApiError } from '../api/client'
import { billingApi, BillingApiError } from '../api/billing'
import { formatCents } from '../lib/formatCents'
import { formatRelative } from '../lib/formatTime'
import { topicTitle } from '../lib/topicTitle'
import type { MyConversationSummary } from '../api/types'

// Three credit packs. Labels are display-only; the server validates `pack`
// is one of {10,20,50} and resolves to its own STRIPE_PRICE_* env var.
const PACKS: Array<{ pack: '10' | '20' | '50'; price: string; credits: string }> = [
  { pack: '10', price: '$10', credits: '800 credits' },
  { pack: '20', price: '$20', credits: '1,600 credits' },
  { pack: '50', price: '$50', credits: '4,000 credits' },
]

// /account — signed-in user's profile. Top: email, live balance, agar token,
// logout. Below: list of their conversations with per-sim total cost and a
// drill-down showing per-round costs.
export function Account() {
  const { email, agarToken, balanceCents, loading, logout, refresh } = useToken()
  const [convs, setConvs] = useState<MyConversationSummary[] | null>(null)
  const [convsError, setConvsError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const paid = params.get('paid')
  const [buyingPack, setBuyingPack] = useState<string | null>(null)
  const [buyError, setBuyError] = useState<string | null>(null)
  // Initial balance at mount — if it changes (webhook credited us) we know
  // to clear the "adding credits" banner. Captured once via ref so the
  // poll-loop doesn't keep resetting it.
  const initialBalanceRef = useRef<number | null>(null)
  useEffect(() => {
    if (initialBalanceRef.current === null && balanceCents !== null) {
      initialBalanceRef.current = balanceCents
    }
  }, [balanceCents])

  useEffect(() => {
    if (!agarToken) return
    let cancelled = false
    api
      .myConversations()
      .then(rows => { if (!cancelled) setConvs(rows) })
      .catch((err: unknown) => {
        if (cancelled) return
        setConvsError(err instanceof ApiError ? err.message : 'Failed to load conversations')
      })
    return () => { cancelled = true }
  }, [agarToken])

  // After Stripe redirects back with ?paid=true, poll /auth/me every 3s for
  // up to 60s until the balance changes (the webhook fires asynchronously
  // from Stripe — usually within seconds). Stop polling once balance bumps;
  // clear the ?paid= param so a reload doesn't re-trigger.
  useEffect(() => {
    if (paid !== 'true') return
    let cancelled = false
    let attempts = 0
    const tick = async () => {
      if (cancelled || attempts >= 20) return  // 20 * 3s = 60s
      attempts++
      try { await refresh() } catch { /* keep trying */ }
      // Detect bump from the snapshot taken before checkout. If balanceCents
      // has gone up since the ref was set, webhook fired — done.
      if (
        initialBalanceRef.current !== null &&
        balanceCents !== null &&
        balanceCents > initialBalanceRef.current
      ) {
        setParams({}, { replace: true })
        return
      }
      setTimeout(tick, 3000)
    }
    void tick()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid])

  const startCheckout = async (pack: '10' | '20' | '50') => {
    if (buyingPack) return
    setBuyingPack(pack)
    setBuyError(null)
    try {
      const { url } = await billingApi.checkout(pack)
      // Snapshot balance NOW so the post-paid poll knows what to compare against
      if (balanceCents !== null) initialBalanceRef.current = balanceCents
      window.location.href = url   // hard redirect to Stripe-hosted checkout
    } catch (err) {
      setBuyingPack(null)
      setBuyError(
        err instanceof BillingApiError
          ? err.message
          : 'Could not start checkout. Try again.',
      )
    }
  }

  if (loading) {
    return (
      <section className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </section>
    )
  }

  if (!email) return <Navigate to="/login?next=/account" replace />

  const totalSpent = convs?.reduce((acc, c) => acc + c.total_cost_cents, 0) ?? null

  return (
    <>
      <section className="panel" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
        <h2 style={{ marginTop: 0 }}>Your account</h2>

        <dl className="account-grid">
          <dt>Email</dt>
          <dd>{email}</dd>

          <dt>Balance</dt>
          <dd>
            {balanceCents === null
              ? <span style={{ color: 'var(--muted)' }}>unavailable</span>
              : <strong>{formatCents(balanceCents)}</strong>}
          </dd>

          {totalSpent !== null && (
            <>
              <dt>Spent</dt>
              <dd>{formatCents(totalSpent)} across {convs!.length} sim{convs!.length === 1 ? '' : 's'}</dd>
            </>
          )}

          <dt>API token</dt>
          <dd>
            <code className="token-pill" title="Share with the operator to top up your balance">
              {agarToken ?? '—'}
            </code>
          </dd>
        </dl>

        {/* Post-checkout banners */}
        {paid === 'true' && (
          <div className="paid-banner paid-banner-success" role="status">
            Payment received — crediting your balance…
          </div>
        )}
        {paid === 'cancelled' && (
          <div className="paid-banner paid-banner-cancel" role="status">
            Checkout cancelled. No charge made.
          </div>
        )}

        <h3 style={{ marginTop: 32, marginBottom: 12, fontSize: '0.95rem' }}>
          Add credits
        </h3>
        <div className="pack-grid">
          {PACKS.map(p => (
            <button
              key={p.pack}
              className="pack-btn"
              onClick={() => void startCheckout(p.pack)}
              disabled={buyingPack !== null}
            >
              <span className="pack-btn-price">{p.price}</span>
              <span className="pack-btn-credits">{p.credits}</span>
              {buyingPack === p.pack && (
                <span className="spinner spinner-inline" style={{ marginTop: 4 }} />
              )}
            </button>
          ))}
        </div>
        {buyError && (
          <div className="error-box" style={{ marginTop: 12 }}>{buyError}</div>
        )}

        <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
          <button className="btn-secondary" onClick={() => void logout()} style={{ flex: 1 }}>
            Sign out
          </button>
        </div>
      </section>

      <section className="panel" style={{ maxWidth: 720, margin: '24px auto 0', padding: '24px' }}>
        <h3 style={{ marginTop: 0 }}>Your discussions</h3>
        {convsError && <div className="error-box">{convsError}</div>}
        {!convsError && convs === null && (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        )}
        {!convsError && convs !== null && convs.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>
            No discussions yet. <Link to="/">Start one</Link>.
          </p>
        )}
        {!convsError && convs !== null && convs.length > 0 && (
          <ul className="conv-list">
            {convs.map(c => <ConvRow key={c.conversation_id} conv={c} />)}
          </ul>
        )}
      </section>
    </>
  )
}

function ConvRow({ conv }: { conv: MyConversationSummary }) {
  const [open, setOpen] = useState(false)
  // round_num=0 is the partial-failure bucket; surface separately if present.
  const realRounds = conv.rounds.filter(r => r.round_num > 0)
  const failedSpend = conv.rounds.find(r => r.round_num === 0)?.cost_cents ?? 0

  return (
    <li className="conv-row">
      <div className="conv-row-head">
        <Link to={`/c/${conv.conversation_id}`} className="conv-row-title">
          {topicTitle(conv.topic)}
        </Link>
        <span className="conv-row-cost">{formatCents(conv.total_cost_cents)}</span>
      </div>
      <div className="conv-row-meta">
        <span className={`conv-row-status status-${conv.status}`}>{conv.status}</span>
        <span>·</span>
        <span className="model-badge">{conv.model_id}</span>
        <span>·</span>
        <span>{conv.round_count} round{conv.round_count === 1 ? '' : 's'}</span>
        <span>·</span>
        <span>{conv.comment_count} comment{conv.comment_count === 1 ? '' : 's'}</span>
        <span>·</span>
        <span>{formatRelative(conv.created_at)}</span>
        {realRounds.length > 0 && (
          <>
            <span>·</span>
            <button
              type="button"
              className="conv-row-toggle"
              onClick={() => setOpen(v => !v)}
            >
              {open ? 'hide rounds' : `show ${realRounds.length} round cost${realRounds.length === 1 ? '' : 's'}`}
            </button>
          </>
        )}
      </div>
      {open && (
        <ul className="round-cost-list">
          {realRounds.map(r => (
            <li key={r.round_num}>
              <span>round {r.round_num}</span>
              <span>{formatCents(r.cost_cents)}</span>
              <span className="round-cost-time">{formatRelative(r.recorded_at)}</span>
            </li>
          ))}
          {failedSpend > 0 && (
            <li className="round-cost-failed">
              <span>partial (failed)</span>
              <span>{formatCents(failedSpend)}</span>
              <span />
            </li>
          )}
        </ul>
      )}
    </li>
  )
}
