export interface TokenResponse {
  token: string
  label: string
  // Starting balance in cents. Named credit_cents server-side since the
  // rounds→cents migration; 0 on hosted (topped up via payment) or a free
  // allowance locally.
  credit_cents: number
}

export interface CreateConversationBody {
  topic: string
  persona_mix: number
  // Tier name from GET /tiers (e.g. "flash"|"pro"|"sonnet"). Omit to use the
  // server's default tier.
  model?: string
}

// GET /tiers response — the FE reads this once at load to build the picker.
export interface Tier {
  name: string
  model: string
  estimate_cents: number
}
export interface TiersResponse {
  default: string
  tiers: Tier[]
}

export interface CreateConversationResponse {
  conversation_id: string
  status: string
  poll: string
  balance_cents: number
}

export type ConversationStatus = 'queued' | 'running' | 'paused' | 'done' | 'converged' | 'failed'

export interface ConversationSummary {
  conversation_id: string
  topic: string
  status: ConversationStatus
  agent_count: number
  round_count: number
  comment_count: number
  sim_upvotes: number
  score: number
  // Tier the sim was created on. Historical sims (pre-picker) default to "flash".
  model_id: string
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
  model_id: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  error: string | null
  comment_count: number
  sim_upvotes: number
  // Cost columns appear ONLY when the caller's X-API-Key matches the
  // conversation's owner. Public viewers see undefined (cost is private to
  // the user who paid for the sim). Use these for inline SimControls hints
  // while the owner is watching their own running sim.
  last_round_cost_cents?: number
  total_cost_cents?: number
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

// /next returns the post-gate balance so the UI can reflect spend without a
// separate balance fetch.
export interface NextRoundResponse {
  conversation_id: string
  status: ConversationStatus
  balance_cents: number
}

// One row in the GET /me/conversations response (owner-authenticated).
// `rounds` carries per-round cost history; round_num=0 is a sentinel for
// partial-failure spend (a round that errored mid-flight still bills its
// partial OpenRouter cost).
export interface MyConversationRound {
  round_num: number
  cost_cents: number
  recorded_at: string
}

export interface MyConversationSummary {
  conversation_id: string
  topic: string
  status: ConversationStatus
  agent_count: number
  round_count: number
  comment_count: number
  sim_upvotes: number
  score: number
  model_id: string
  created_at: string
  finished_at: string | null
  total_cost_cents: number
  last_round_cost_cents: number
  rounds: MyConversationRound[]
}
