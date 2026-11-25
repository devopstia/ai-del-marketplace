#!/usr/bin/env bash
# Isolated preview of the current branch: a second stack (project "del-preview") beside the main one.
#   ./scripts/preview.sh up        build and start (http://localhost:3100)
#   ./scripts/preview.sh seed      seed + import DEL (run the smoke/e2e tests now if wanted)
#   ./scripts/preview.sh demo      owner's demo catalogue: only "AI for DevOps" listed
#   ./scripts/preview.sh down      stop, keep data      ./scripts/preview.sh destroy   stop and delete preview data
set -euo pipefail
cd "$(dirname "$0")/.."
export COMPOSE_PROJECT_NAME=del-preview
F=(-f docker-compose.yml -f docker-compose.preview.yml)
case "${1:-up}" in
  up) docker compose "${F[@]}" up -d --build --wait api web worker ;;
  seed)
    docker compose "${F[@]}" exec -T api npm run seed
    docker compose "${F[@]}" -f docker-compose.import.yml run --rm --no-deps -T api npm run import:del ;;
  demo) API=http://127.0.0.1:4100 ./scripts/demo-catalogue.sh ;;
  down) docker compose "${F[@]}" down ;;
  destroy) docker compose "${F[@]}" down -v ;;
  *) echo "usage: $0 up|seed|demo|down|destroy" >&2; exit 2 ;;
esac
