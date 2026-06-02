import { Outlet } from 'react-router-dom'
import { TokenProvider } from './api/token'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'

// App shell. Public by default — reading discussions does not require login.
// Routes that need a session (compose, reply, upvote, next round) check the
// auth state themselves and either render an inline "Sign in" prompt or
// redirect to /login. The Nav shows sign-in/account affordances.
export default function App() {
  return (
    <TokenProvider>
      <div className="page-shell">
        <Nav />
        <main className="stack">
          <Outlet />
        </main>
        <Footer />
      </div>
    </TokenProvider>
  )
}
