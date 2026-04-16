import type {
  TokenResponse,
  CreateConversationBody,
  CreateConversationResponse,
  ConversationSummary,
  ConversationDetail,
  ThreadResponse,
  UpvoteResponse,
  CommentBody,
  CommentResponse,
  PauseResumeResponse,
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
    let message = `HTTP ${res.status}`
    if (typeof body.detail === 'string') {
      message = body.detail
    } else if (Array.isArray(body.detail)) {
      message = body.detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ')
    } else if (body.detail) {
      message = JSON.stringify(body.detail)
    }
    throw new ApiError(res.status, message)
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

  next: (id: string) =>
    request<PauseResumeResponse>(`/conversations/${id}/next`, {
      method: 'POST',
    }),

  finish: (id: string) =>
    request<PauseResumeResponse>(`/conversations/${id}/finish`, {
      method: 'POST',
    }),

  comment: (id: string, body: CommentBody) =>
    request<CommentResponse>(`/conversations/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

export { getToken, setToken }
