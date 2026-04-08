import { Outlet } from 'react-router-dom'
import { TokenProvider } from './api/token'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'

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
