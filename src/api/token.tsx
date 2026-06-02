import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { setToken } from './client'
import { authApi, AuthApiError } from './auth'

// Identity context. Source of truth = the session cookie held by the browser
// for disc-app-api. On mount we GET /auth/me; if 401, the user is logged out
// and a login screen is rendered instead of the app shell. If 200, we cache
// the agar X-API-Key into localStorage so the existing agar client picks it
// up unchanged.

interface AuthState {
  // null = unauthenticated (logged out or unknown). All app routes that need
  // auth should branch on this.
  email: string | null
  // The agar X-API-Key for this user. Mirrored to localStorage('agar-token')
  // so api/client.ts can read it without prop drilling.
  agarToken: string | null
  // Balance in cents. null while loading OR when agar is unreachable.
  balanceCents: number | null
  loading: boolean
  // Non-fatal error fetching /auth/me (network etc.). Distinct from "not
  // logged in" which surfaces as email === null and loading === false.
  error: string | null
}

interface AuthContextValue extends AuthState {
  // Push a fresh balance from a mutation response (createConversation, next).
  // Keeps the Nav display live without an extra fetch.
  setBalance: (cents: number) => void
  // After the FE knows the user logged in (callback page or after a successful
  // /auth/consume), seed the context with the new agar_token and refetch /me.
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  email: null,
  agarToken: null,
  balanceCents: null,
  loading: true,
  error: null,
  setBalance: () => {},
  refresh: async () => {},
  logout: async () => {},
})

export function useToken() {
  return useContext(AuthContext)
}

export function TokenProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    email: null,
    agarToken: null,
    balanceCents: null,
    loading: true,
    error: null,
  })

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const me = await authApi.me()
      // Cache agar token for api/client.ts which reads localStorage.
      setToken(me.agar_token)
      setState({
        email: me.email,
        agarToken: me.agar_token,
        balanceCents: me.balance_cents,
        loading: false,
        error: null,
      })
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 401) {
        // Not logged in — clean state; render the login screen.
        localStorage.removeItem('agar-token')
        localStorage.removeItem('agar-label')
        setState({
          email: null,
          agarToken: null,
          balanceCents: null,
          loading: false,
          error: null,
        })
        return
      }
      // Network or 5xx — keep showing the app shell but flag the error.
      setState(s => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Could not load account',
      }))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setBalance = (cents: number) =>
    setState(s => ({ ...s, balanceCents: cents }))

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // best-effort; clear local state regardless
    }
    localStorage.removeItem('agar-token')
    localStorage.removeItem('agar-label')
    setState({
      email: null,
      agarToken: null,
      balanceCents: null,
      loading: false,
      error: null,
    })
  }

  return (
    <AuthContext.Provider value={{ ...state, setBalance, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
