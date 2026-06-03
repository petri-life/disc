-- Stripe billing layer. Adds the linkage from disc-app users to Stripe
-- customers, plus an idempotency table for webhook deliveries.

-- Stripe customer per user. Nullable: created lazily on first /billing/checkout
-- so users who never pay don't get a Stripe customer record. Once set, never
-- changes — Stripe's customer object is the stable lookup key for receipts,
-- billing portal, refunds.
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;

CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

-- Webhook idempotency. Stripe at-least-once-delivers events; the same
-- checkout.session.completed can arrive twice (network flake, Stripe retry
-- after our 5xx, manual replay from dashboard). Without dedup we'd double-
-- credit the user. event.id is unique per Stripe event; INSERT-ignore on
-- collision = idempotent.
CREATE TABLE stripe_events (
  event_id   TEXT PRIMARY KEY,    -- Stripe event.id, e.g. "evt_1Abc..."
  event_type TEXT NOT NULL,       -- "checkout.session.completed", etc.
  user_id    INTEGER,             -- our user, when known
  credited_cents INTEGER,         -- what we credited, for audit
  processed_at INTEGER NOT NULL   -- unix seconds
);

CREATE INDEX idx_stripe_events_user ON stripe_events(user_id);
