import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import { Home } from './pages/Home'
import { Conversation } from './pages/Conversation'
import { Browse } from './pages/Browse'
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
