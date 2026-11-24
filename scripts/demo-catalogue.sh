#!/usr/bin/env bash
# Owner-approved demo catalogue (DECISIONS 2026-11-24): only "AI for DevOps" is listed. Unpublishes the seeded demo
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
for id in $(call "$API/admin/courses?status=published&pageSize=100" | jq -r '.items[] | select(.slug != "ai-for-devops") | .id'); do
  call -X POST "$API/admin/courses/$id/unpublish" --data '{"note":"Demo catalogue: only AI for DevOps is listed (owner decision 2026-11-24)"}' | jq -r '"unpublished: \(.id)"'
done
echo "listed: $(curl -sf "$API/courses?pageSize=48" | jq -r '[.items[].slug] | join(", ")')"
