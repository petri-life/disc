// Client for disc-app-api (the auth + identity layer). Separate from the
// agar client in client.ts: different base URL, sends credentials (session
// cookie), no X-API-Key. The agar client still talks to agar-api directly
// with the X-API-Key sourced from /auth/me.

const AUTH_BASE = import.meta.env.VITE_AUTH_API_BASE || ''

export class AuthApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      // not json
    }
    throw new AuthApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export interface MeResponse {
  email: string
  agar_token: string
  // null when agar is unreachable / token revoked; the FE shows "—" then.
  balance_cents: number | null
  detail?: string
}

export interface ConsumeResponse {
  user: { email: string; agar_token: string }
}

export const authApi = {
  me: () => request<MeResponse>('/auth/me'),
  requestLink: (email: string) =>
    request<{ ok: true }>('/auth/request-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  consume: (code: string) =>
    request<ConsumeResponse>('/auth/consume', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  logout: () =>
    request<{ ok: true }>('/auth/logout', { method: 'POST' }),
}
