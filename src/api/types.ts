export interface TokenResponse {
  token: string
  label: string
  credits: number
}

export interface CreateConversationBody {
  topic: string
  persona_mix: number
}

export interface CreateConversationResponse {
  conversation_id: string
  status: string
  poll: string
}

export type ConversationStatus = 'queued' | 'running' | 'paused' | 'done' | 'converged' | 'failed'

export interface ConversationSummary {
  conversation_id: string
  topic: string
  status: ConversationStatus
  agent_count: number
  round_count: number
  score: number
  created_at: string
}

export interface ProgressEntry {
  id: number
  message: string
  stage: string
  ts: string
}

export interface ConversationDetail {
  conversation_id: string
  topic: string
  status: ConversationStatus
  agent_count: number
  round_count: number
  persona_mix: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  error: string | null
  progress: ProgressEntry[]
}

export interface ThreadUser {
  user_id: number
  name: string
  bio: string
}

export interface ThreadPost {
  post_id: number
  user_id: number
  content: string
  created_at: string
  sim_score: number
}

export interface ThreadComment {
  comment_id: number
  post_id: number
  user_id: number
  content: string
  created_at: string
  sim_score: number
  parent_comment_id: number | null
  upvotes: number
}

export interface ThreadResponse {
  posts: ThreadPost[]
  comments: ThreadComment[]
  users: Record<string, ThreadUser>
}

export interface UpvoteResponse {
  comment_id: number
  upvotes: number
}

export interface CommentBody {
  content: string
  parent_comment_id?: number | null
}

export interface CommentResponse {
  comment_id: number
  user_id: number
}

export interface PauseResumeResponse {
  conversation_id: string
  status: ConversationStatus
}
