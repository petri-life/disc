// Worker bindings + env shape, mirroring wrangler.toml.
export interface Env {
  // D1
  DB: D1Database

  // Public vars (set in wrangler.toml [vars])
  AGAR_API_BASE: string
  APP_ORIGIN: string
  EMAIL_FROM: string
  MAGIC_LINK_TTL_SECONDS: string
  SESSION_TTL_SECONDS: string

  // Secrets (set via `wrangler secret put`)
  AGAR_MINT_SECRET: string
  RESEND_API_KEY: string
  SESSION_SIGNING_KEY: string
}
