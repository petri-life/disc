import type {
  TokenResponse,
  CreateConversationBody,
  CreateConversationResponse,
  ConversationSummary,
  ConversationDetail,
  ThreadResponse,
  UpvoteResponse,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function getToken(): string | null {
  return localStorage.getItem('agar-token')
}

function setToken(token: string): void {
  localStorage.setItem('agar-token', token)
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'X-API-Key': token } : {}),
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  mintToken: () =>
    request<TokenResponse>('/tokens', { method: 'POST' }),

  createConversation: (body: CreateConversationBody) =>
    request<CreateConversationResponse>('/conversations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listConversations: () =>
    request<ConversationSummary[]>('/conversations'),

  getConversation: (id: string, after = 0) =>
    request<ConversationDetail>(`/conversations/${id}?after=${after}`),

  getThread: (id: string) =>
    request<ThreadResponse>(`/conversations/${id}/thread`),

  upvote: (id: string, commentId: number) =>
    request<UpvoteResponse>(`/conversations/${id}/upvote/${commentId}`, {
      method: 'POST',
    }),
}

export { getToken, setToken }
