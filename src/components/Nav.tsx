import { Link, useLocation } from 'react-router-dom'
import { BrandMark } from './BrandMark'
import { useToken } from '../api/token'
import { formatCents } from '../lib/formatCents'

export function Nav() {
  const { email, balanceCents, loading } = useToken()
  const { pathname } = useLocation()
  // Preserve where the user is so signing in returns them here.
  const nextParam = pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : ''

  return (
    <header className="masthead">
      <div className="masthead-bar">
        <Link to="/" className="brand-lockup">
          <BrandMark />
          <div className="brand-copy">
            <h1>Petri Disc</h1>
            <p>Synthetic discussion</p>
          </div>
        </Link>

        {loading ? null : email ? (
          <Link to="/account" className="user-chip" title="Account">
            <span className="user-email">{email}</span>
            {balanceCents !== null && (
              <span className="user-balance"> · {formatCents(balanceCents)}</span>
            )}
          </Link>
        ) : (
          <Link to={`/login${nextParam}`} className="signin-link">
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
