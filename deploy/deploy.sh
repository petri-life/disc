#!/usr/bin/env bash
# End-to-end deploy: agar-oss (Fly) + disc-app (Cloudflare Pages, FE + auth
# Functions). Reads secrets from disc-app/.env.verify (gitignored).
#
# The auth API lives as Pages Functions under functions/ — same origin as the
# FE so the session cookie is first-party. No standalone Worker.
#
# Prerequisites (one-time, interactive):
#   fly auth login
#   bun x wrangler login
#   .env.verify populated with: OPENROUTER_API_KEY, AGAR_MINT_SECRET,
#                                RESEND_API_KEY, APP_ORIGIN, CF_PAGES_PROJECT,
#                                FLY_APP
#
# Usage:
#   bash deploy/deploy.sh agar      # just agar-oss → Fly
#   bash deploy/deploy.sh pages     # just disc-app → Cloudflare Pages (FE + Functions)
#   bash deploy/deploy.sh all       # both, in order
set -euo pipefail

DISC_APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGAR_OSS="$(cd "$DISC_APP/../agar-oss" && pwd)"
TARGET="${1:-all}"

[ -f "$DISC_APP/.env.verify" ] || { echo "FAIL: missing $DISC_APP/.env.verify"; exit 1; }
# shellcheck disable=SC1091
set -a; source "$DISC_APP/.env.verify"; set +a
for v in OPENROUTER_API_KEY AGAR_MINT_SECRET RESEND_API_KEY APP_ORIGIN CF_PAGES_PROJECT FLY_APP; do
  [ -n "${!v:-}" ] || { echo "FAIL: $v unset in .env.verify"; exit 1; }
done

deploy_agar() {
  echo "── agar-oss → Fly app: $FLY_APP ─────────────────────────"
  # CORS origin + Referer are pushed as Fly "secrets" (per-env runtime vars)
  # so fly.toml stays env-agnostic.
  fly secrets set --app "$FLY_APP" --stage \
    OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
    AGAR_MINT_SECRET="$AGAR_MINT_SECRET" \
    AGAR_CORS_ORIGINS="$APP_ORIGIN" \
    AGAR_HTTP_REFERER="$APP_ORIGIN"
  fly deploy \
    --app "$FLY_APP" \
    --config "$DISC_APP/deploy/fly.toml" \
    --dockerfile "$AGAR_OSS/Dockerfile" \
    "$AGAR_OSS"
  echo "(skip persona upload if already done — re-run upload-personas.sh as needed)"
}

deploy_pages() {
  echo "── disc-app → Cloudflare Pages: $CF_PAGES_PROJECT ───────"
  cd "$DISC_APP"

  # Generate a session signing key once if not in the file; persist it so
  # restarts don't log everyone out. Rewrite-in-place to avoid duplicates.
  if [ -z "${SESSION_SIGNING_KEY:-}" ]; then
    SESSION_SIGNING_KEY="$(openssl rand -hex 32)"
    if grep -qE '^SESSION_SIGNING_KEY=' "$DISC_APP/.env.verify"; then
      sed -i.bak -E "s|^SESSION_SIGNING_KEY=.*|SESSION_SIGNING_KEY=$SESSION_SIGNING_KEY|" \
        "$DISC_APP/.env.verify"
      rm -f "$DISC_APP/.env.verify.bak"
    else
      echo "SESSION_SIGNING_KEY=$SESSION_SIGNING_KEY" >> "$DISC_APP/.env.verify"
    fi
    echo "  generated and saved a fresh SESSION_SIGNING_KEY"
  fi

  # Pages secrets (read by Functions at runtime). Idempotent — overwrites.
  # EMAIL_FROM sourced from .env.verify; falls back to Resend's onboarding
  # sender for new setups before a domain is verified.
  : "${EMAIL_FROM:=Petri Disc <onboarding@resend.dev>}"
  for kv in \
    "AGAR_MINT_SECRET:$AGAR_MINT_SECRET" \
    "RESEND_API_KEY:$RESEND_API_KEY" \
    "SESSION_SIGNING_KEY:$SESSION_SIGNING_KEY" \
    "APP_ORIGIN:$APP_ORIGIN" \
    "EMAIL_FROM:$EMAIL_FROM"
  do
    name="${kv%%:*}"
    val="${kv#*:}"
    printf '%s' "$val" | bun x wrangler pages secret put "$name" \
      --project-name "$CF_PAGES_PROJECT"
  done

  # Apply D1 migrations against the remote DB (idempotent — only new ones run).
  bun x wrangler d1 migrations apply disc_app_db --remote

  # Build the FE. Auth lives at /auth/* on the same origin, so VITE_AUTH_API_BASE
  # is empty (relative fetches go to the Pages Functions).
  cat > .env.production <<EOF
VITE_API_BASE=https://${FLY_APP}.fly.dev
VITE_AUTH_API_BASE=
EOF
  echo "  build env:"; sed 's/^/    /' .env.production
  bun install
  # Unset any VITE_* that leaked via `set -a; source .env.verify` so Vite
  # reads ONLY the .env.production we just wrote. Otherwise a stale shell
  # export silently overrides the file and a stale URL gets baked in.
  unset VITE_API_BASE VITE_AUTH_API_BASE
  bun run build

  # Pages deploy ships dist/ AND functions/. Branch=main goes to production.
  bun x wrangler pages deploy dist \
    --project-name "$CF_PAGES_PROJECT" \
    --branch main \
    --commit-dirty=true
}

case "$TARGET" in
  agar)   deploy_agar ;;
  pages)  deploy_pages ;;
  all)    deploy_agar; deploy_pages ;;
  *) echo "Usage: $0 {agar|pages|all}"; exit 1 ;;
esac

echo ""
echo "Done."
