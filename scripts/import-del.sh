#!/usr/bin/env bash
# Import the real DevOps Easy Learning catalogue into the running local stack (idempotent).
# The source (ai-videos/projects/ai-devops) is mounted READ-ONLY; nothing is written there.
# Run the seed first:  docker compose exec api npm run seed
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker compose -f docker-compose.yml -f docker-compose.import.yml run --rm --no-deps -T api npm run import:del
