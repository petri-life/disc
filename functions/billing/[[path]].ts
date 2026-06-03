// Stripe billing Pages Functions. Lives at /billing/*. Two endpoints:
//
//   POST /billing/checkout  — auth'd; creates a Stripe Checkout Session
//                              for one of the three predefined price packs,
//                              returns the hosted checkout URL.
//
//   POST /billing/webhook   — public; Stripe POSTs here after a session
//                              completes. We verify the signature, dedup on
//                              event.id, then call agar /credits/add.

import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { z } from 'zod'

import type { Env } from '../_lib/types/env'
import { agar, AgarError } from '../_lib/services/agar'
import {
  createCustomer,
  createCheckoutSession,
  retrieveCheckoutSession,
  verifyAndParseWebhook,
  WebhookVerificationError,
} from '../_lib/services/stripe'
import {
  findUserById,
  isStripeEventProcessed,
  recordStripeEvent,
  setUserStripeCustomer,
} from '../_lib/services/users'
import {
  nowSeconds,
  readSessionCookie,
  verifySession,
} from '../_lib/session'

const app = new Hono<{ Bindings: Env }>().basePath('/billing')

// ── POST /billing/checkout ──────────────────────────────────

const CheckoutBody = z.object({
  // Allowlist: only the three configured packs are checkout-able. price_id
  // comes from the browser but we validate against env so a user can't
  // construct a checkout for an arbitrary Stripe product.
  pack: z.enum(['10', '20', '50']),
})

app.post('/checkout', async c => {
  // Auth: must be a signed-in user.
  const cookie = readSessionCookie(c.req.header('cookie') ?? null)
  if (!cookie) return c.json({ detail: 'Sign in required' }, 401)
  const payload = await verifySession(cookie, c.env.SESSION_SIGNING_KEY)
  if (!payload) return c.json({ detail: 'Session invalid' }, 401)

  const user = await findUserById(c.env.DB, payload.userId)
  if (!user || !user.agar_token) {
    return c.json({ detail: 'Account not initialised' }, 401)
  }

  const parsed = CheckoutBody.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ detail: 'Invalid pack' }, 400)

  const priceMap: Record<string, string> = {
    '10': c.env.STRIPE_PRICE_10,
    '20': c.env.STRIPE_PRICE_20,
    '50': c.env.STRIPE_PRICE_50,
  }
  const priceId = priceMap[parsed.data.pack]
  if (!priceId) {
    // env var missing — config error, not user error
    return c.json({ detail: 'Server misconfigured (price)' }, 500)
  }

  // Get or create Stripe customer linked to this user. Lazily — users who
  // never click "Buy" never get a Stripe customer record.
  let stripeCustomerId = user.stripe_customer_id
  if (!stripeCustomerId) {
    try {
      const cust = await createCustomer(c.env.STRIPE_SECRET_KEY, {
        email: user.email,
        userId: user.id,
      })
      stripeCustomerId = cust.id
      await setUserStripeCustomer(c.env.DB, user.id, stripeCustomerId)
    } catch (err) {
      console.error('createCustomer failed:', err)
      return c.json({ detail: 'Could not initialise billing' }, 500)
    }
  }

  // Metadata is mirrored on the Session AND the customer. We read it back
  // in the webhook to know who to credit, in case Stripe's customer link
  // somehow gets dropped from the session.
  const metadata = {
    user_id: String(user.id),
    agar_token: user.agar_token,
    pack: parsed.data.pack,
  }

  try {
    const session = await createCheckoutSession(c.env.STRIPE_SECRET_KEY, {
      customer: stripeCustomerId,
      priceId,
      successUrl: `${c.env.APP_ORIGIN}/account?paid=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${c.env.APP_ORIGIN}/account?paid=cancelled`,
      metadata,
    })
    return c.json({ url: session.url })
  } catch (err) {
    console.error('createCheckoutSession failed:', err)
    return c.json({ detail: 'Could not start checkout' }, 500)
  }
})

// ── POST /billing/webhook ──────────────────────────────────

app.post('/webhook', async c => {
  // CRITICAL: read RAW bytes for signature verification. Hono's c.req.json()
  // would mutate by re-stringifying with different whitespace, breaking the
  // HMAC. We MUST verify against the exact bytes Stripe signed.
  const rawBody = await c.req.text()
  const signatureHeader = c.req.header('stripe-signature') ?? ''

  let event
  try {
    event = await verifyAndParseWebhook({
      payload: rawBody,
      signatureHeader,
      secret: c.env.STRIPE_WEBHOOK_SECRET,
      nowSeconds: nowSeconds(),
    })
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      // Don't echo the reason — attackers shouldn't learn signature debugging
      // hints. Log server-side, return generic 400.
      console.warn('webhook verification failed:', err.message)
      return c.json({ detail: 'Bad signature' }, 400)
    }
    throw err
  }

  // Idempotency: if we already processed this event.id, exit OK so Stripe
  // stops retrying. We do NOT credit twice.
  if (await isStripeEventProcessed(c.env.DB, event.id)) {
    return c.json({ ok: true, dedup: true })
  }

  // We only act on completed checkouts for now. Other events (refunds,
  // disputes) we just record-and-acknowledge so Stripe stops retrying;
  // we'll add handlers when we need them.
  if (event.type !== 'checkout.session.completed') {
    await recordStripeEvent(c.env.DB, {
      event_id: event.id,
      event_type: event.type,
      user_id: null,
      credited_cents: null,
      processed_at: nowSeconds(),
    })
    return c.json({ ok: true, ignored: true, type: event.type })
  }

  // Re-fetch the session WITH line_items expanded so we get the
  // product.metadata.credit_cents. The webhook payload only includes a
  // session ID by default.
  const session = event.data.object as { id: string; metadata?: Record<string, string> }
  let full
  try {
    full = await retrieveCheckoutSession(c.env.STRIPE_SECRET_KEY, session.id)
  } catch (err) {
    console.error('retrieveCheckoutSession failed:', err)
    return c.json({ detail: 'Could not load session' }, 500)
  }

  // Defensive: extract user info from session metadata (we set it at
  // create_checkout time). Stripe sometimes drops fields; if user_id is
  // missing we 500 + skip recording so Stripe retries.
  const userIdStr = full.metadata?.user_id
  const agarToken = full.metadata?.agar_token
  if (!userIdStr || !agarToken) {
    console.error('webhook session missing metadata:', full.metadata)
    return c.json({ detail: 'Missing metadata on session' }, 500)
  }
  const userId = parseInt(userIdStr, 10)

  // Pull credit_cents off the line item's price's product metadata. This is
  // the single source of truth for "how many credits did they buy" — set
  // when the products were created in Stripe.
  const lineItem = full.line_items?.data?.[0]
  const product = lineItem?.price?.product
  if (!product || typeof product === 'string') {
    console.error('webhook product not expanded:', full)
    return c.json({ detail: 'Product metadata not available' }, 500)
  }
  const creditCentsStr = product.metadata?.credit_cents
  const creditCents = parseInt(creditCentsStr ?? '', 10)
  if (!Number.isFinite(creditCents) || creditCents <= 0) {
    console.error('webhook product missing credit_cents metadata:', product)
    return c.json({ detail: 'Product missing credit_cents metadata' }, 500)
  }

  // Top up the user's agar balance.
  try {
    await agar.topUp(
      c.env.AGAR_API_BASE,
      c.env.AGAR_MINT_SECRET,
      agarToken,
      creditCents,
    )
  } catch (err) {
    const status = err instanceof AgarError ? err.status : 500
    console.error('agar topUp failed:', err)
    // Don't record the event — let Stripe retry. We're (idempotency-wise)
    // safe because we record AFTER credit succeeds.
    return c.json({ detail: `Could not credit balance (agar ${status})` }, 500)
  }

  // Success — record the event so Stripe doesn't retry, and we can audit.
  await recordStripeEvent(c.env.DB, {
    event_id: event.id,
    event_type: event.type,
    user_id: userId,
    credited_cents: creditCents,
    processed_at: nowSeconds(),
  })
  console.log(`webhook ${event.id}: credited user=${userId} cents=${creditCents}`)
  return c.json({ ok: true, credited_cents: creditCents })
})

export const onRequest = handle(app)
