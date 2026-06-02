import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import { Home } from './pages/Home'
import { Conversation } from './pages/Conversation'
import { Browse } from './pages/Browse'
import { AuthCallback } from './pages/AuthCallback'
import { Login } from './pages/Login'
import { Account } from './pages/Account'
import './styles/reset.css'
import './styles/tokens.css'
import './styles/global.css'
import './styles/components.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="c/:id" element={<Conversation />} />
          <Route path="browse" element={<Browse />} />
          <Route path="login" element={<Login />} />
          <Route path="account" element={<Account />} />
          {/* /login/callback (NOT /auth/callback) — the /auth/* prefix is owned
              by the Pages Function and would 404 a client-side route there. */}
          <Route path="login/callback" element={<AuthCallback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
