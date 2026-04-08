import { Link } from 'react-router-dom'
import { BrandMark } from './BrandMark'
import { useToken } from '../api/token'

export function Nav() {
  const { label } = useToken()

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
        {label && (
          <div className="user-label" title="Your anonymous ID — mention it to request more credits">
            {label}
          </div>
        )}
      </div>
    </header>
  )
}
