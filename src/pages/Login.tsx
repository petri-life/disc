import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { authApi, AuthApiError } from '../api/auth'
import { useToken } from '../api/token'

// Sign in via magic link. Reached from /login (Nav button or gated action).
// On success the link email contains /auth/callback?code=...&next=<encoded>.
// If already logged in, redirect home (or to ?next).
export function Login() {
  const { email: currentEmail, loading } = useToken()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Persist the `next` destination so /auth/callback knows where to redirect.
  // We can't put it inside the magic-link URL (server emails the link, not us),
  // so stash in sessionStorage keyed to this tab.
  useEffect(() => {
    if (next && next !== '/') sessionStorage.setItem('auth-next', next)
  }, [next])

  if (loading) return null
  if (currentEmail) return <Navigate to={next} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const trimmed = email.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    try {
      await authApi.requestLink(trimmed)
      setSent(true)
    } catch (err) {
      setError(
        err instanceof AuthApiError
          ? err.message
          : 'Could not send sign-in email. Try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <section className="panel" style={{ textAlign: 'center', padding: '48px 24px', maxWidth: 480, margin: '0 auto' }}>
        <h2>Check your email</h2>
        <p style={{ color: 'var(--muted)', marginTop: 12 }}>
          We sent a sign-in link to <strong>{email}</strong>. Click it to continue.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 24 }}>
          The link expires in 15 minutes. Didn't get it? Check spam, or{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            try a different email
          </button>
          .
        </p>
      </section>
    )
  }

  return (
    <section className="panel" style={{ maxWidth: 480, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ marginTop: 0 }}>Sign in to Petri Disc</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Enter your email — we'll send you a sign-in link. No password.
      </p>
      <form onSubmit={submit}>
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 6,
            marginBottom: 12,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting || !email.trim()}
          style={{ width: '100%' }}
        >
          {submitting ? (
            <>
              <span className="spinner spinner-inline" /> Sending...
            </>
          ) : (
            'Send sign-in link'
          )}
        </button>
        {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
      </form>
    </section>
  )
}
