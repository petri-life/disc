#!/usr/bin/env bash
# Push the curated personas from disc-app/data/personas/ to the agar-oss Fly
# volume at /app/data/personas/. Run once after persona changes (or on first
# deploy). The volume must already exist:
#
#   fly volumes create agar_data --size 1 --region ewr
#
# Usage:  bash deploy/upload-personas.sh           (uses 'app' from fly.toml)
#         bash deploy/upload-personas.sh my-app    (override the app name)
set -euo pipefail

DISC_APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PERSONAS="$DISC_APP/data/personas"
FLY_CONFIG="$DISC_APP/deploy/fly.toml"
APP="${1:-$(awk -F"'" '/^app *=/ {print $2; exit}' "$FLY_CONFIG")}"

[ -n "$APP" ] || { echo "FAIL: no Fly app name (pass as arg or set 'app' in deploy/fly.toml)"; exit 1; }
command -v fly >/dev/null || { echo "FAIL: 'fly' CLI not installed. https://fly.io/docs/flyctl/install/"; exit 1; }
for f in personas_sarc personas_hn_spicy personas_adversarial personas_creative; do
  [ -f "$PERSONAS/$f.jsonl" ] || { echo "FAIL: missing $PERSONAS/$f.jsonl"; exit 1; }
done

echo "Uploading personas to $APP:/app/data/personas/ ..."
# Wake a machine so SFTP has something to connect to (suspend mode is default).
fly machine start --app "$APP" 2>/dev/null || true

# Create the dir via REGULAR shell — `fly ssh sftp shell` only supports
# cd/ls/get/put/chmod (mkdir there silently no-ops, which used to leave the
# dir absent and every subsequent `put` failed with "file does not exist").
fly ssh console --app "$APP" -C 'mkdir -p /app/data/personas'

# Then push each file via sftp. Absolute paths on both sides.
# `put` REFUSES to overwrite existing files ("file exists on VM"), so we
# rm via regular shell first. Each upload is therefore atomic-replace:
# remove old, write new. If a sim is mid-flight, the old file's contents
# are already loaded in memory — replacing the file on disk doesn't disturb it.
for f in "$PERSONAS"/personas_*.jsonl; do
  name="$(basename "$f")"
  echo "  $name ($(wc -l < "$f" | tr -d ' ') rows)"
  fly ssh console --app "$APP" -C "rm -f /app/data/personas/$name"
  fly ssh sftp shell --app "$APP" <<EOF
put $f /app/data/personas/$name
EOF
done

echo "Done. Verifying on the volume..."
fly ssh console --app "$APP" -C 'ls -la /app/data/personas/'
