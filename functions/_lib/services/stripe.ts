// Stripe client for Pages Functions. Direct HTTPS to api.stripe.com — no
// Stripe SDK (the official one pulls in node:crypto / streams, awkward in
// Workers). We need exactly three things:
//   1. Create a Checkout Session (POST to /v1/checkout/sessions)
//   2. Create or fetch a Customer (POST/GET /v1/customers)
//   3. Verify a webhook signature (HMAC-SHA256 of timestamp.payload)
//
// Everything is form-urlencoded per Stripe convention (NOT JSON).

export class StripeError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const STRIPE_API = "https://api.stripe.com/v1"

// Encode nested objects + arrays per Stripe's bracket convention:
//   { metadata: { user_id: "1" } }              -> metadata[user_id]=1
//   { payment_method_types: ["card"] }          -> payment_method_types[0]=card
//   { line_items: [{ price: "p_1", qty: 1 }] }  -> line_items[0][price]=p_1&line_items[0][qty]=1
//
// First version of this function naively coerced arrays via String(v), which
// produced 'line_items=[object Object]' and Stripe quietly accepted then
// returned a checkout session that 500'd on use. Always walk arrays + objects
// recursively; only scalars hit the encode-and-emit branch.
function toForm(obj: unknown, prefix = ""): string {
  const parts: string[] = []
  const emit = (key: string, value: unknown) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      value.forEach((item, i) => emit(`${key}[${i}]`, item))
    } else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        emit(`${key}[${k}]`, v)
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }
  if (prefix) {
    emit(prefix, obj)
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      emit(k, v)
    }
  }
  return parts.join("&")
}

async function stripeRequest<T>(
  apiKey: string,
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = method === "GET" && body
    ? `${STRIPE_API}${path}?${toForm(body)}`
    : `${STRIPE_API}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: method === "POST" && body ? toForm(body) : undefined,
  })
  const text = await res.text()
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { parsed = { error: text } }
  if (!res.ok) {
    const err = (parsed as { error?: { message?: string } }).error
    throw new StripeError(res.status, err?.message ?? `Stripe ${res.status}`)
  }
  return parsed as T
}

// ── Customers ──────────────────────────────────────────────

export interface StripeCustomer {
  id: string
  email: string | null
  metadata: Record<string, string>
}

export async function createCustomer(
  apiKey: string,
  args: { email: string; userId: number },
): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>(apiKey, "POST", "/customers", {
    email: args.email,
    metadata: { user_id: String(args.userId) },
  })
}

// ── Checkout ───────────────────────────────────────────────

export interface CheckoutSession {
  id: string
  url: string
}

export async function createCheckoutSession(
  apiKey: string,
  args: {
    customer: string
    priceId: string
    successUrl: string
    cancelUrl: string
    metadata: Record<string, string>
  },
): Promise<CheckoutSession> {
  return stripeRequest<CheckoutSession>(apiKey, "POST", "/checkout/sessions", {
    customer: args.customer,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: args.priceId, quantity: 1 }],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    metadata: args.metadata,
  })
}

// ── Sessions (after webhook fires, to pull line_items + price metadata) ──

export interface CheckoutSessionFull {
  id: string
  customer: string | null
  metadata: Record<string, string>
  payment_status: string
  amount_total: number | null
  line_items?: {
    data: Array<{
      price: {
        id: string
        product: {
          id: string
          metadata: Record<string, string>
        } | string
      }
      quantity: number
    }>
  }
}

export async function retrieveCheckoutSession(
  apiKey: string,
  sessionId: string,
): Promise<CheckoutSessionFull> {
  // expand=line_items.data.price.product → so we get metadata.credit_cents
  // off the product without a second fetch.
  return stripeRequest<CheckoutSessionFull>(
    apiKey,
    "GET",
    `/checkout/sessions/${sessionId}`,
    {
      "expand[]": "line_items.data.price.product",
    },
  )
}

// ── Webhook signature verification ─────────────────────────

// Stripe-Signature header looks like:
//   t=1234567890,v1=<hex>,v1=<hex>
// We compute HMAC-SHA256("{t}.{rawBody}", secret) and check it matches
// at least one of the v1 values (constant-time). Then we also enforce a
// freshness window so an attacker can't replay an old signed payload.
//
// https://docs.stripe.com/webhooks/signatures

const REPLAY_TOLERANCE_SECONDS = 300 // 5 min — Stripe's default

export class WebhookVerificationError extends Error {}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message))
  const bytes = new Uint8Array(sig)
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")
}

export interface StripeEvent {
  id: string                              // evt_...
  type: string                            // "checkout.session.completed", etc.
  data: { object: Record<string, unknown> }
  created: number
}

export async function verifyAndParseWebhook(args: {
  payload: string                        // RAW request body, byte-perfect
  signatureHeader: string                // Stripe-Signature header value
  secret: string                         // STRIPE_WEBHOOK_SECRET (whsec_...)
  nowSeconds: number
}): Promise<StripeEvent> {
  // Parse header
  const items = args.signatureHeader.split(",").map(p => p.trim().split("="))
  const ts = items.find(([k]) => k === "t")?.[1]
  const sigs = items.filter(([k]) => k === "v1").map(([, v]) => v)
  if (!ts || sigs.length === 0) {
    throw new WebhookVerificationError("Malformed Stripe-Signature header")
  }
  const t = parseInt(ts, 10)
  if (!Number.isFinite(t)) {
    throw new WebhookVerificationError("Bad timestamp in Stripe-Signature")
  }
  if (Math.abs(args.nowSeconds - t) > REPLAY_TOLERANCE_SECONDS) {
    throw new WebhookVerificationError("Stripe webhook timestamp out of tolerance")
  }

  const expected = await hmacSha256Hex(args.secret, `${ts}.${args.payload}`)
  const ok = sigs.some(s => timingSafeEqual(s, expected))
  if (!ok) {
    throw new WebhookVerificationError("Stripe webhook signature mismatch")
  }

  // Verified — safe to parse the body.
  return JSON.parse(args.payload) as StripeEvent
}
