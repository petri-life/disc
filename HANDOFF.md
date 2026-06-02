# Agar OSS Split — Handoff

*Written 2026-05-25. Source of truth for the agar OSS release + how disc-app (this repo) stays the hosted frontend.*

## The model

- **agar** (`../agar`) — stays private, becomes the hosted backend source. Archived later.
- **new OSS repo** — fresh copy-paste of agar, minus personas / temp docs / fly / internal refs, with a fresh `git init`. No history rewrite — a clean copy is provably free of the scraped persona data that lives in agar's old commits.
- **disc-app** (this repo) — the hosted frontend for agar. Already wired to agar's exact API (`src/api/client.ts`). Stays private.

Free path = clone OSS repo, BYO-personas (or use shipped synthetic samples), run locally.
Hosted path = disc-app → agar-api on Fly, curated personas, paywall in front.

---

## Part 1 — Token / credit API (current state + planned change)

### Current state (1 credit = 1 round)

agar bills a flat **1 credit per round**, regardless of agent count or token cost.

- `api/db.py:110` `spend_credit()` — deduct 1, atomic, returns False if zero
- `api/db.py:128` `refund_credit()` — +1 on round failure
- `api/db.py:102` `topup_key()` — +N (used by `agar-keys topup`)
- `credits_remaining INTEGER` column (`api/db.py:27`)
- New token mints with `AGAR_DEFAULT_CREDITS` (env: `20`, fly.toml overrides to `5`)
- `POST /tokens` (`api/main.py:160`) — **open, anyone can mint a free token**

API surface (all under `X-API-Key`):
```
POST   /tokens                              mint anonymous token
POST   /conversations                       start (runs round 1, costs 1 credit)
GET    /conversations                       list
GET    /conversations/{id}?after=N          poll status + progress
GET    /conversations/{id}/thread           full thread
POST   /conversations/{id}/comment          inject OP comment
POST   /conversations/{id}/upvote/{cid}     upvote
POST   /conversations/{id}/next             run next round (costs 1 credit)
POST   /conversations/{id}/finish           mark done
DELETE /conversations/{id}                   delete
GET    /health
```

disc-app already consumes all of these (`src/api/client.ts`). No frontend change needed for the existing flow.

### Planned change — credits become cents, metered per round

**Why:** flat 1-credit/round doesn't track real LLM cost. A 36-agent round costs ~$0.04 (measured: Gemini 2.5 Flash, ~$0.0011/call × 36). Caps + worst-case pricing works, but cent-metering is more honest and the data is free — OpenRouter returns `usage.cost` per call.

**Design (per-round metering — matches existing lifecycle):**
1. Reinterpret `credits_remaining` as **cents**, not rounds. One-shot migration multiplies existing rows.
2. At round start: estimate worst case (e.g. 10¢), block if balance < estimate (HTTP 429).
3. After round: sum `usage.cost` across all agent calls, deduct actual cents via a new `decrement_cents(key, n)` (generalize `spend_credit`). Refund unused estimate.
4. On failure: existing refund path (`api/runner.py:110`) refunds the round's actual spend.

**Metering point = per round.** Round is already the atomic lifecycle unit (`session.run(rounds=1)` at `api/runner.py:99`). Per-call fights the concurrent-agent execution; per-sim risks runaway spend with no checkpoint.

**Cost source:** OpenRouter response `usage.cost` (USD, exact). Anthropic-direct path has no cost field — needs a token×rate table if hosted ever uses Haiku direct. Hosted runs OpenRouter (Gemini), so this is fine.

**Effort:** ~60–80 lines across `api/db.py`, `api/runner.py`, LLM call sites in `sim/`, plus a migration script. *Not yet implemented — spec only.*

### Paywall seam (build in disc-app + a thin agar gate)

No Stripe exists anywhere yet (agar or disc-app) — built from scratch.

- **`POST /tokens` must be gated on hosted.** Add `AGAR_MINT_SECRET` env var. If set, `/tokens` requires matching `X-Mint-Secret` header. If unset (OSS default), stays open. ~5 lines, zero impact on OSS users.
- **`POST /credits/add`** — new endpoint, same `AGAR_MINT_SECRET` gate. disc-app's Stripe webhook calls it to top up after payment.
- **All Stripe code lives in disc-app** (or a tiny disc-app backend/edge function). agar never imports Stripe.

Flow: `user → disc-app Stripe checkout → webhook → agar POST /credits/add (with mint secret) → balance up`.

**Pricing (decided):** one $10 pack → ~$8 of credits, cost + 25% buffer (covers Stripe fee + Fly). No subscription, no tiers. disc-app shows live per-round cost + balance (`tokensRemaining` display already exists in the mort frontend; port the pattern).

---

## Part 2 — Personas split

### Current state

`api/sampler.py` assembles a fixed 36-agent population from 4 JSONL files in `agar/personas/`:

| File | Rows | Role | env override |
|---|---|---|---|
| `personas_sarc.jsonl` | 12 | spicy (always) | `AGAR_SARC_PATH` |
| `personas_hn_spicy.jsonl` | 6 | spicy (always) | `AGAR_HN_SPICY_PATH` |
| `personas_adversarial.jsonl` | 50 | flavor pool | `AGAR_ADVERSARIAL_PATH` |
| `personas_creative.jsonl` | 18 | flavor pool | `AGAR_CREATIVE_PATH` |

18 spicy always present + 18 flavor slots split by `persona_mix` (0=creative, 1=adversarial).

### The split

These files are the **actual moat** (curated from the sift pipeline) and contain **verbatim scraped HN comments + app-store reviews** — including a sexual-harassment-lawsuit anecdote in `personas_adversarial.jsonl`. **They cannot ship publicly** (legal/privacy).

**OSS repo:** ships 4–6 hand-written **synthetic** personas per file (~1 KB total) so the smoke test + first-run demo pass. Document the JSONL schema in the README so OSS users build their own. `_load_jsonl` already returns `[]` for missing files (`sampler.py:30`), so a partial/empty set degrades gracefully.

**Hosted (curated) personas:** move the real files **here, into disc-app**, under `disc-app/data/personas/` (private repo, no publish risk). The Fly deployment mounts them and points the 4 `AGAR_*_PATH` env vars at the mount. **No code coupling** between repos — the env var is the entire seam.

> Open question for whoever executes: confirm disc-app's deploy can mount/ship these files, or whether they should live on the Fly volume directly (`agar_data` mount at `/app/data`). Either works; volume is simpler if disc-app deploys as static frontend only.

---

## Part 3 — Spin up hosted version (as it works today)

The hosted stack = **agar-api on Fly** + **disc-app frontend** pointed at it.

### Backend (agar on Fly)
```
# from agar repo (private)
fly deploy                          # uses agar/fly.toml (app: agar-api)
fly secrets set OPENROUTER_API_KEY=...
fly secrets set AGAR_MINT_SECRET=...        # once the gate lands
# personas: mounted on agar_data volume at /app/data, or set AGAR_*_PATH
```
Relevant fly.toml env (current): `AGAR_MODEL=haiku` (set `OPENROUTER_API_KEY` to switch to Gemini), `AGAR_MAX_CONCURRENT=1`, `AGAR_ROUNDS=5`, `AGAR_DEFAULT_CREDITS=5`, `AGAR_SHOW_PERSONAS=1`. Volume `agar_data` → `/app/data`, 1 GB. `auto_stop_machines=suspend`, `min_machines_running=0`.

### Frontend (disc-app)
```
# this repo
echo "VITE_API_BASE=https://agar-api.fly.dev" > .env   # currently '' (same-origin)
bun install && bun run build
# deploy dist/ to wherever disc-app is hosted
```
`src/api/client.ts:14` reads `VITE_API_BASE`. Token stored in `localStorage('agar-token')`. All endpoints already match agar.

### Scaling note
Current: 1 sim at a time (`AGAR_MAX_CONCURRENT=1`), 1 VM, I/O-bound on the LLM provider. To raise: bump `AGAR_MAX_CONCURRENT=3` + VM to 2 GB. Add startup orphan-sweep (mark `status='running'` rows failed + refund) since `_running` dict is in-memory and `suspend` can orphan a mid-flight sim. VM-per-sim (Fly Machines API) is a later concern — don't build for traffic you don't have.

---

## Part 4 — OSS repo creation checklist

Copy-paste agar → new repo, `git init` fresh. **Include** `api/ sim/ cli.py smoke_test.py pyproject.toml uv.lock ARCHITECTURE.md`.

**Exclude / nuke:**
- `personas/*.jsonl` → replace with synthetic samples
- `PLAN.md`, `SESSION_PLAN.md` — internal strategy docs, delete
- `.claude/CLAUDE.md` — lists internal sister repos (`petri-life/{mort,sift,web-app}`), rewrite as a clean public CLAUDE.md or drop
- `fly.toml` — hosted deploy config; replace with `deploy/examples/fly.toml`
- `data/`, `log/` — runtime/local artifacts
- `.analysis/` — this analysis dir, never ship

**Scrub before publish:**
- `sim/openrouter_model.py:116,131` — `petri.life` hardcoded as HTTP-Referer → env var
- `api/main.py:84` — CORS `allow_origins=["*"]` → `AGAR_CORS_ORIGINS` env var (hosted locks to disc-app origin; OSS defaults open)
- grep for `sift`, `petri`, `mort` references across remaining files

**Add:**
- `LICENSE` — **Apache-2.0** (matches CAMEL/OASIS which agar is built on; standard for the agent-sim space)
- `README.md` — outsider-facing (clone → `uv sync` → run); current docs are internal
- `deploy/examples/` — `fly.toml`, `docker-compose.yml`
- PR-from-forks CI workflow (current CI is Fly-deploy-only)

**Verified clean:** no secrets/keys in agar git history (`git log --all -p | grep -iE 'api[_-]?key|secret|token'` → only env reads + `secrets` stdlib).

**Est. effort to publishable:** ~8 h. Largest chunks: README (2 h), CI (1 h), synthetic personas (1 h), clean-clone dry run (1 h).

---

## Reference: full analysis

`../agar/.analysis/` has the source research — `REPO_MAP.md`, `STRATEGY_SPECTRUM.md`, `EXTRACTION_PLAN.md`, `PRECEDENTS.md`. Read those for the why behind any decision above.
