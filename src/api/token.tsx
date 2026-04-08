import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from './client'

interface TokenState {
  token: string | null
  label: string | null
  credits: number | null
  loading: boolean
  error: string | null
}

const TokenContext = createContext<TokenState>({
  token: null,
  label: null,
  credits: null,
  loading: true,
  error: null,
})

export function useToken() {
  return useContext(TokenContext)
}

function getLabel(): string | null {
  return localStorage.getItem('agar-label')
}

function setLabel(label: string): void {
  localStorage.setItem('agar-label', label)
}

export function TokenProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TokenState>(() => {
    const existing = getToken()
    const existingLabel = getLabel()
    return {
      token: existing,
      label: existingLabel,
      credits: null,
      loading: !existing,
      error: null,
    }
  })

  useEffect(() => {
    if (state.token && state.label) return

    // No token — mint fresh. Has token but no label — clear stale token and re-mint.
    if (state.token && !state.label) {
      localStorage.removeItem('agar-token')
    }

    api.mintToken()
      .then(({ token, label, credits }) => {
        setToken(token)
        setLabel(label)
        setState({ token, label, credits, loading: false, error: null })
      })
      .catch((err: Error) => {
        setState(s => ({ ...s, loading: false, error: err.message }))
      })
  }, [state.token, state.label])

  return (
    <TokenContext.Provider value={state}>
      {children}
    </TokenContext.Provider>
  )
}
