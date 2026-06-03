// User + magic-link persistence in D1. Pure functions over a D1Database.
//
// Lifecycle:
//   request-link: insert magic_links row, send email
//   consume     : validate + mark consumed, upsert user, bootstrap agar token
//                 if missing, set session cookie
//   me          : read session, look up user, fetch live balance from agar

export interface User {
  id: number
  email: string
  agar_token: string | null
  created_at: number
  last_login_at: number | null
  // Linked Stripe customer. Null until the user clicks "Buy credits" for the
  // first time. Once set, never changes — Stripe's customer is the stable
  // anchor for receipts, refunds, the billing portal.
  stripe_customer_id: string | null
}

export interface MagicLink {
  code: string
  email: string
  created_at: number
  expires_at: number
  consumed_at: number | null
}

export async function createMagicLink(
  db: D1Database,
  row: { code: string; email: string; created_at: number; expires_at: number },
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO magic_links (code, email, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
    .bind(row.code, row.email, row.created_at, row.expires_at)
    .run()
}

export async function countRecentLinks(
  db: D1Database,
  email: string,
  sinceSeconds: number,
): Promise<number> {
  const res = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM magic_links WHERE email = ? AND created_at >= ?',
    )
    .bind(email, sinceSeconds)
    .first<{ n: number }>()
  return res?.n ?? 0
}

// Atomically consume a link: mark consumed_at if and only if it is unconsumed
// and unexpired. Returns the link row iff the atomic update flipped exactly
// one row. Two concurrent consume calls cannot both succeed.
export async function consumeMagicLink(
  db: D1Database,
  code: string,
  nowSeconds: number,
): Promise<MagicLink | null> {
  const upd = await db
    .prepare(
      'UPDATE magic_links SET consumed_at = ? ' +
        'WHERE code = ? AND consumed_at IS NULL AND expires_at > ?',
    )
    .bind(nowSeconds, code, nowSeconds)
    .run()
  if (upd.meta.changes !== 1) return null
  return db
    .prepare('SELECT * FROM magic_links WHERE code = ?')
    .bind(code)
    .first<MagicLink>()
}

export async function findUserByEmail(
  db: D1Database,
  email: string,
): Promise<User | null> {
  return db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>()
}

export async function findUserById(
  db: D1Database,
  id: number,
): Promise<User | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>()
}

// Upsert by email. Used at the start of /auth/consume so we have a user row
// before minting the agar token. Returns the existing or freshly created row.
export async function upsertUserByEmail(
  db: D1Database,
  email: string,
  nowSeconds: number,
): Promise<User> {
  const existing = await findUserByEmail(db, email)
  if (existing) {
    await db
      .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .bind(nowSeconds, existing.id)
      .run()
    return { ...existing, last_login_at: nowSeconds }
  }
  const ins = await db
    .prepare(
      'INSERT INTO users (email, created_at, last_login_at) VALUES (?, ?, ?)',
    )
    .bind(email, nowSeconds, nowSeconds)
    .run()
  return {
    id: ins.meta.last_row_id as number,
    email,
    agar_token: null,
    created_at: nowSeconds,
    last_login_at: nowSeconds,
    stripe_customer_id: null,
  }
}

export async function setUserAgarToken(
  db: D1Database,
  userId: number,
  agarToken: string,
): Promise<void> {
  await db
    .prepare('UPDATE users SET agar_token = ? WHERE id = ?')
    .bind(agarToken, userId)
    .run()
}

export async function setUserStripeCustomer(
  db: D1Database,
  userId: number,
  stripeCustomerId: string,
): Promise<void> {
  await db
    .prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')
    .bind(stripeCustomerId, userId)
    .run()
}

// ── Stripe event idempotency ────────────────────────────────

/** Returns true if this event_id has already been processed (skip), false if
 *  it's new (record + process). Atomic via INSERT OR IGNORE on PK. */
export async function isStripeEventProcessed(
  db: D1Database,
  eventId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM stripe_events WHERE event_id = ?')
    .bind(eventId)
    .first<{ '1': number }>()
  return row !== null
}

export async function recordStripeEvent(
  db: D1Database,
  args: {
    event_id: string
    event_type: string
    user_id: number | null
    credited_cents: number | null
    processed_at: number
  },
): Promise<void> {
  await db
    .prepare(
      'INSERT OR IGNORE INTO stripe_events ' +
        '(event_id, event_type, user_id, credited_cents, processed_at) ' +
        'VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      args.event_id,
      args.event_type,
      args.user_id,
      args.credited_cents,
      args.processed_at,
    )
    .run()
}
