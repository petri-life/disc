// Signed session cookies. The cookie payload is `user_id.expires_at.signature`
// where the signature is HMAC-SHA256 over `user_id.expires_at` with
// SESSION_SIGNING_KEY. No DB row — rotating the key invalidates every session.

const COOKIE_NAME = 'disc_session'

function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message))
  return b64urlEncode(new Uint8Array(sig))
}

// Constant-time string compare to avoid signature-timing oracles.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

export interface SessionPayload {
  userId: number
  expiresAt: number // unix seconds
}

export async function signSession(
  payload: SessionPayload,
  signingKey: string,
): Promise<string> {
  const body = `${payload.userId}.${payload.expiresAt}`
  const sig = await hmac(signingKey, body)
  return `${body}.${sig}`
}

export async function verifySession(
  cookie: string,
  signingKey: string,
): Promise<SessionPayload | null> {
  const parts = cookie.split('.')
  if (parts.length !== 3) return null
  const [userIdStr, expiresAtStr, sig] = parts
  const body = `${userIdStr}.${expiresAtStr}`
  const expected = await hmac(signingKey, body)
  if (!timingSafeEqual(sig, expected)) return null
  const expiresAt = parseInt(expiresAtStr, 10)
  if (!Number.isFinite(expiresAt) || expiresAt < nowSeconds()) return null
  const userId = parseInt(userIdStr, 10)
  if (!Number.isFinite(userId)) return null
  return { userId, expiresAt }
}

export function buildSessionCookie(value: string, ttlSeconds: number): string {
  return [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${ttlSeconds}`,
  ].join('; ')
}

export function buildLogoutCookie(): string {
  return [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=0'].join('; ')
}

export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE_NAME) return v.join('=')
  }
  return null
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

// CSPRNG hex string. 32 bytes → 64 hex chars. Used for magic link codes.
export function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
