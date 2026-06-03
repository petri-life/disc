// Client for /billing/* Pages Functions. Same shape as auth.ts — relative
// URLs (same-origin), credentials sent so the session cookie reaches the
// server-side checkout endpoint.

export class BillingApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      // not json
    }
    throw new BillingApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export const billingApi = {
  /** Start a Stripe Checkout for one of the three packs. Returns the hosted
   *  Stripe URL — caller redirects the browser there. */
  checkout: (pack: '10' | '20' | '50') =>
    request<{ url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ pack }),
    }),
}
