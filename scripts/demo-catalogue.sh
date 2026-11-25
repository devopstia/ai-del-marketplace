#!/usr/bin/env bash
# Owner-approved demo catalogue (DECISIONS 2026-11-24): "AI for DevOps" plus the sample courses the owner asked for
# (2026-11-25, `sample-*`) are listed. Unpublishes the seeded demo
# instructor's courses through the admin API (so the change is audited). Enrolled learners keep access.
# Run after: docker compose exec api npm run seed && ./scripts/import-del.sh
set -euo pipefail
cd "$(dirname "$0")/.."
API="${API:-http://127.0.0.1:4000}/api"
SEED_PASSWORD="$(grep -E '^SEED_PASSWORD=' .env | cut -d= -f2-)"
JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
csrf() { awk '$6=="csrf"{print $7}' "$JAR" | tail -1; }
call() { curl -sf -b "$JAR" -c "$JAR" -H 'Content-Type: application/json' -H "X-CSRF-Token: $(csrf)" "$@"; }

curl -sf -b "$JAR" -c "$JAR" "$API/auth/csrf" >/dev/null
call -X POST "$API/auth/login" --data "{\"email\":\"admin@del.example\",\"password\":\"$SEED_PASSWORD\"}" >/dev/null
# Two-step sign-in (docs/AUTH.md): the demo accounts use SEED_MFA_SECRET from .env.
# A code works once per account: if this 30-second step was already used, wait for the next one (no failed attempts pile up).
for i in 1 2; do
  call -X POST "$API/auth/mfa/complete" --data "{\"code\":\"$(node scripts/totp.mjs)\"}" >/dev/null && break
  [ "$i" = 2 ] && { echo "sign-in failed (two-step code)" >&2; exit 1; }
  sleep $((31 - $(date +%s) % 30))
done
for id in $(call "$API/admin/courses?status=published&pageSize=100" | jq -r '.items[] | select(.slug != "ai-for-devops" and (.slug | startswith("sample-") | not)) | .id'); do
  call -X POST "$API/admin/courses/$id/unpublish" --data '{"note":"Demo catalogue: only AI for DevOps is listed (owner decision 2026-11-24)"}' | jq -r '"unpublished: \(.id)"'
done
echo "listed: $(curl -sf "$API/courses?pageSize=48" | jq -r '[.items[].slug] | join(", ")')"
