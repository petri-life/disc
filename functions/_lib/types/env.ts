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

  // Deploy version — source of truth is disc-app/VERSION, pushed at deploy
  // time by deploy.sh. Treated mechanically as a Pages "secret" only because
  // Pages has no plain-runtime-var API; the value itself is public and is
  // served on /health.
  APP_VERSION: string

  // Stripe — TEST or LIVE mode depending on which keys are pushed. Keys
  // never reach the browser; checkout/webhook are server-only.
  STRIPE_SECRET_KEY: string         // sk_test_... or sk_live_...
  STRIPE_WEBHOOK_SECRET: string     // whsec_... — signs every webhook delivery
  STRIPE_PRICE_10: string           // price_... for the $10 pack
  STRIPE_PRICE_20: string           // price_... for the $20 pack
  STRIPE_PRICE_50: string           // price_... for the $50 pack
}
