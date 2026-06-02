#!/usr/bin/env bash
# Verify the agar-oss metering loop end-to-end against a locally-booted backend,
# using the real curated personas + the same env the hosted deploy uses.
#
# Proves, with a real Gemini round (real usage.cost):
#   1. /tokens and /credits/add are gated by X-Mint-Secret (401 without it).
#   2. A round is blocked when balance < estimate (402).
#   3. A fake payment tops the balance up.
#   4. After a real round, balance dropped by exactly the reconciled cost
#      (last_round_cost_cents) — i.e. cost metering actually bills real cents.
#
# Requires disc-app/.env.verify (gitignored) with a real OPENROUTER_API_KEY and
# an AGAR_MINT_SECRET. See .env.verify.example.
#
# Usage:  bun run verify:metering   (or: bash scripts/verify-metering.sh)
set -euo pipefail

DISC_APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGAR_OSS="$(cd "$DISC_APP/../agar-oss" && pwd)"
PERSONAS="$DISC_APP/data/personas"
PORT="${VERIFY_PORT:-8099}"
BASE="http://127.0.0.1:$PORT"

# ── preconditions ──────────────────────────────────────────────
[ -f "$DISC_APP/.env.verify" ] || { echo "FAIL: missing $DISC_APP/.env.verify (copy .env.verify.example)"; exit 1; }
# shellcheck disable=SC1091
set -a; source "$DISC_APP/.env.verify"; set +a
[ -n "${OPENROUTER_API_KEY:-}" ] || { echo "FAIL: OPENROUTER_API_KEY unset in .env.verify — metering needs it"; exit 1; }
[ -n "${AGAR_MINT_SECRET:-}" ] || { echo "FAIL: AGAR_MINT_SECRET unset in .env.verify"; exit 1; }
[ -d "$AGAR_OSS" ] || { echo "FAIL: agar-oss not found at $AGAR_OSS"; exit 1; }
for f in personas_sarc personas_hn_spicy personas_adversarial personas_creative; do
  [ -f "$PERSONAS/$f.jsonl" ] || { echo "FAIL: missing persona file $PERSONAS/$f.jsonl"; exit 1; }
done

# ── boot agar-oss with prod settings + real personas ───────────
# Matches agar/fly.toml env; AGAR_*_PATH points at disc-app's curated copies.
export AGAR_MODEL=haiku \
       AGAR_OPENROUTER_MODEL=google/gemini-2.5-flash \
       AGAR_ROUNDS=5 AGAR_MAX_CONCURRENT=1 AGAR_SHOW_PERSONAS=1 \
       AGAR_RELOAD=0 \
       AGAR_DEFAULT_CREDIT_CENTS=0 AGAR_ROUND_ESTIMATE_CENTS=10 \
       AGAR_SARC_PATH="$PERSONAS/personas_sarc.jsonl" \
       AGAR_HN_SPICY_PATH="$PERSONAS/personas_hn_spicy.jsonl" \
       AGAR_ADVERSARIAL_PATH="$PERSONAS/personas_adversarial.jsonl" \
       AGAR_CREATIVE_PATH="$PERSONAS/personas_creative.jsonl" \
       PORT="$PORT"
# NOTE: agar-oss hardcodes its sqlite path to agar-oss/data/agar_api.db (the
# local dev DB). This verify run mints a fresh token and only touches that
# token, so it does not disturb other local data; it does not use a prod DB.

echo "Booting agar-oss on $BASE..."
( cd "$AGAR_OSS" && .venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port "$PORT" --log-level warning ) &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

# wait for /health
for _ in $(seq 1 40); do
  if curl -fsS "$BASE/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
curl -fsS "$BASE/health" >/dev/null || { echo "FAIL: server did not come up"; exit 1; }

# ── drive the loop (assertions live in Python for JSON + polling) ─
cd "$AGAR_OSS" && BASE="$BASE" MINT_SECRET="$AGAR_MINT_SECRET" .venv/bin/python -u "$DISC_APP/scripts/verify_metering.py"
