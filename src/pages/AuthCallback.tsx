import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, AuthApiError } from '../api/auth'
import { useToken } from '../api/token'

// /auth/callback?code=... — invoked when the user clicks the magic link.
// Posts the code to /auth/consume; on success the cookie is set, then we
// refresh the auth context and redirect to home.
export function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useToken()
  const [error, setError] = useState<string | null>(null)
  // StrictMode double-invokes effects in dev; the magic link is single-use,
  // so a naive useEffect would consume the link twice and the second call 400s.
  const consumed = useRef(false)

  useEffect(() => {
    if (consumed.current) return
    consumed.current = true

    const code = params.get('code')
    if (!code) {
      setError('Missing sign-in code in URL.')
      return
    }

    ;(async () => {
      try {
        await authApi.consume(code)
        await refresh()
        // Resume the original destination (set by /login before redirect)
        // so a gated action like /c/abc resumes there instead of dumping
        // the user back at home.
        const next = sessionStorage.getItem('auth-next') || '/'
        sessionStorage.removeItem('auth-next')
        navigate(next, { replace: true })
      } catch (err) {
        setError(
          err instanceof AuthApiError
            ? err.message
            : 'Could not sign in. Try requesting a new link.',
        )
      }
    })()
  }, [params, navigate, refresh])

  if (error) {
    return (
      <section className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <h2>Sign-in failed</h2>
        <p className="error-box" style={{ marginTop: 12 }}>{error}</p>
        <p style={{ marginTop: 24 }}>
          <a href="/" className="btn-secondary">Back to sign-in</a>
        </p>
      </section>
    )
  }

  return (
    <section className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div className="spinner" style={{ margin: '0 auto 12px' }} />
      <p style={{ color: 'var(--muted)' }}>Signing you in…</p>
    </section>
  )
}
