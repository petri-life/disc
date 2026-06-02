// Thin client for agar-api. Holds the mint secret on the Worker side; the
// browser never sees it. Each function maps to one agar endpoint we use from
// the server-side auth flow.

export class AgarError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function call<T>(
  base: string,
  path: string,
  init: RequestInit,
  mintSecret?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (mintSecret) headers['X-Mint-Secret'] = mintSecret
  const res = await fetch(`${base}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.text()
    // Surface agar's detail message if present so caller can decide what to do.
    let detail = body
    try {
      const parsed = JSON.parse(body) as { detail?: unknown }
      if (typeof parsed.detail === 'string') detail = parsed.detail
    } catch {
      // body wasn't JSON — keep the raw text
    }
    throw new AgarError(res.status, `agar ${path} → ${res.status}: ${detail}`)
  }
  return res.json() as Promise<T>
}

export interface AgarMintResponse {
  token: string
  label: string
  credit_cents: number
}

export interface AgarBalanceResponse {
  balance_cents: number
}

export interface AgarTopupResponse {
  token: string
  balance_cents: number
}

export const agar = {
  // Mint a fresh anonymous agar token. Privileged (gated by mint secret on
  // hosted). We call this once per user during /auth/consume of a NEW user.
  mintToken: (base: string, mintSecret: string) =>
    call<AgarMintResponse>(base, '/tokens', { method: 'POST' }, mintSecret),

  // Read live balance for an existing token. Authenticated by the token
  // itself (X-API-Key), not the mint secret — any token can read its own.
  getBalance: (base: string, token: string) =>
    call<AgarBalanceResponse>(base, '/balance', {
      method: 'GET',
      headers: { 'X-API-Key': token },
    }),

  // Top up a token's balance. Privileged (mint secret). Stripe webhook calls
  // this after a successful charge; for now you call it manually via curl.
  topUp: (base: string, mintSecret: string, token: string, cents: number) =>
    call<AgarTopupResponse>(
      base,
      '/credits/add',
      { method: 'POST', body: JSON.stringify({ token, cents }) },
      mintSecret,
    ),
}
