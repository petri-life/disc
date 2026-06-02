// Cloudflare Pages Function: handles /auth/*. Served from petri-disc.pages.dev
// so the session cookie is first-party (same eTLD+1 as the FE) — no SameSite=None,
// no CHIPS, no third-party cookie blocking. CORS is also unneeded for same-origin
// fetches.
//
// The Hono router below is the same shape as the standalone Worker version was;
// only the entry adapter changed (handle/cloudflare-pages vs default export).

import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { z } from 'zod'

import type { Env } from '../_lib/types/env'
import { agar, AgarError } from '../_lib/services/agar'
import { sendEmail, magicLinkEmail } from '../_lib/services/email'
import {
  buildLogoutCookie,
  buildSessionCookie,
  nowSeconds,
  randomHex,
  readSessionCookie,
  signSession,
  verifySession,
} from '../_lib/session'
import {
  consumeMagicLink,
  countRecentLinks,
  createMagicLink,
  findUserById,
  setUserAgarToken,
  upsertUserByEmail,
} from '../_lib/services/users'

const RATE_LIMIT_PER_HOUR = 5

// basePath('/auth') so the routes below match the Pages-served prefix.
const app = new Hono<{ Bindings: Env }>().basePath('/auth')

const RequestLinkBody = z.object({
  email: z.string().email().max(254).transform(s => s.toLowerCase().trim()),
})

app.post('/request-link', async c => {
  const parsed = RequestLinkBody.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ detail: 'Invalid email' }, 400)
  const { email } = parsed.data

  const now = nowSeconds()
  const hourAgo = now - 3600
  const recent = await countRecentLinks(c.env.DB, email, hourAgo)
  if (recent >= RATE_LIMIT_PER_HOUR) return c.json({ ok: true })

  const ttl = parseInt(c.env.MAGIC_LINK_TTL_SECONDS, 10)
  const code = randomHex(32)
  await createMagicLink(c.env.DB, {
    code,
    email,
    created_at: now,
    expires_at: now + ttl,
  })

  const tpl = magicLinkEmail({
    appOrigin: c.env.APP_ORIGIN,
    code,
    email,
    ttlMinutes: Math.floor(ttl / 60),
  })
  try {
    await sendEmail({
      apiKey: c.env.RESEND_API_KEY,
      from: c.env.EMAIL_FROM,
      to: email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    })
  } catch (err) {
    return c.json({ detail: 'Could not send email; try again.' }, 500)
  }
  return c.json({ ok: true })
})

const ConsumeBody = z.object({ code: z.string().length(64) })

app.post('/consume', async c => {
  const parsed = ConsumeBody.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ detail: 'Invalid code' }, 400)
  const { code } = parsed.data

  const now = nowSeconds()
  const link = await consumeMagicLink(c.env.DB, code, now)
  if (!link) return c.json({ detail: 'Link expired or already used' }, 400)

  const user = await upsertUserByEmail(c.env.DB, link.email, now)

  let agarToken = user.agar_token
  if (!agarToken) {
    try {
      const minted = await agar.mintToken(c.env.AGAR_API_BASE, c.env.AGAR_MINT_SECRET)
      agarToken = minted.token
      await setUserAgarToken(c.env.DB, user.id, agarToken)
    } catch (err) {
      const status = err instanceof AgarError ? err.status : 500
      return c.json(
        { detail: `Could not bootstrap account (agar ${status})` },
        500,
      )
    }
  }

  const sessionTtl = parseInt(c.env.SESSION_TTL_SECONDS, 10)
  const cookieValue = await signSession(
    { userId: user.id, expiresAt: now + sessionTtl },
    c.env.SESSION_SIGNING_KEY,
  )
  c.header('Set-Cookie', buildSessionCookie(cookieValue, sessionTtl))

  return c.json({ user: { email: user.email, agar_token: agarToken } })
})

app.get('/me', async c => {
  const cookie = readSessionCookie(c.req.header('cookie') ?? null)
  if (!cookie) return c.json({ detail: 'Not logged in' }, 401)
  const payload = await verifySession(cookie, c.env.SESSION_SIGNING_KEY)
  if (!payload) return c.json({ detail: 'Session invalid or expired' }, 401)

  const user = await findUserById(c.env.DB, payload.userId)
  if (!user || !user.agar_token) {
    return c.json({ detail: 'Account not initialised' }, 401)
  }

  try {
    const r = await agar.getBalance(c.env.AGAR_API_BASE, user.agar_token)
    return c.json({
      email: user.email,
      agar_token: user.agar_token,
      balance_cents: r.balance_cents,
    })
  } catch (err) {
    return c.json({
      email: user.email,
      agar_token: user.agar_token,
      balance_cents: null,
      detail: 'Balance unavailable',
    })
  }
})

app.post('/logout', c => {
  c.header('Set-Cookie', buildLogoutCookie())
  return c.json({ ok: true })
})

export const onRequest = handle(app)
