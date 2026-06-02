# Deploy — disc-app (FE + auth API) + agar-oss (sim API)

disc-app is the **deploy-complete** repo: it ships the frontend (React/Vite),
the auth/identity Worker (Hono on Cloudflare Workers + D1), the curated
personas, and the deploy config for the agar-oss backend on Fly.

```
disc-app/
├── src/                        ← Vite frontend (Cloudflare Pages)
├── workers/api/                ← disc-app-api Worker (Cloudflare Workers + D1)
├── data/personas/              ← curated personas (private)
├── deploy/
│   ├── fly.toml                ← agar-oss config
│   ├── upload-personas.sh
│   └── deploy.sh               ← one-shot deploy of all 3 tiers
└── .env.verify                 ← secrets (gitignored)

agar-oss/                       ← sim backend code (clean of any private data)
                                  Deployed to Fly FROM disc-app/deploy/fly.toml.
```

## Architecture

```
Browser ── X-API-Key ─────────────────────────────────────► agar-api  (Fly)
   │                                                          ▲
   │                                                          │ X-Mint-Secret
   │ session cookie                                           │ (privileged)
   ▼                                                          │
disc-app-api  (Cloudflare Workers + D1)  ─────────────────────┘
  /auth/request-link → Resend email
  /auth/consume      → mint agar token via POST /tokens, set cookie
  /auth/me           → read cookie, GET agar /balance, return user
  /auth/logout
```

The browser holds **two credentials**:
- A session cookie (set by disc-app-api, identifies the user).
- An agar X-API-Key (returned by `/auth/me`, used for sim ops directly against
  agar-api). Cached in `localStorage('agar-token')` for the existing client.

The browser never sees the mint secret — only the Worker holds it.

## One-time setup

```bash
# 1. CLI auth (opens browsers)
fly auth login
cd workers/api && bun x wrangler login

# 2. Create the Fly volume (one-time)
fly volumes create agar_data --size 1 --region ewr --app agar-api

# 3. Create the D1 database (one-time)
cd workers/api
bun x wrangler d1 create disc_app_db
# ← copy the printed database_id into wrangler.toml [[d1_databases]]

# 4. Populate disc-app/.env.verify with:
#      OPENROUTER_API_KEY=...
#      AGAR_MINT_SECRET=...           (generate: openssl rand -hex 32)
#      RESEND_API_KEY=re_...
#      APP_ORIGIN=https://disc-app.pages.dev
#      CF_PAGES_PROJECT=disc-app
#      FLY_APP=agar-api
#    SESSION_SIGNING_KEY is generated automatically on first worker deploy.

# 5. Push curated personas to the Fly volume
bash deploy/upload-personas.sh
```

## Deploy

```bash
# All three tiers in order:
bash deploy/deploy.sh all

# Or individually:
bash deploy/deploy.sh agar     # agar-oss → Fly
bash deploy/deploy.sh worker   # disc-app-api → Cloudflare Workers
bash deploy/deploy.sh fe       # frontend → Cloudflare Pages
```

## End-to-end smoke test (after deploy)

1. Visit `$APP_ORIGIN` → login screen
2. Enter your email → "Check your email"
3. Click the magic link → redirects to home, signed in
4. Top up your credits (no Stripe yet — manual curl):
   ```bash
   # Get your agar token from the browser devtools localStorage 'agar-token'
   curl -X POST https://agar-api.fly.dev/credits/add \
     -H "X-Mint-Secret: $AGAR_MINT_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"token":"agar-XXXXX","cents":800}'
   ```
5. Refresh the page → balance shows 800¢
6. Submit a topic → real round runs, balance drops

## Verify metering locally (no deploy)

```bash
bun run verify:metering
```

This boots agar-oss locally and asserts the full mint/pay/run/reconcile loop
works with a real Gemini round (~$0.04). Independent of the auth layer.
