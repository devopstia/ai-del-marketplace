#!/usr/bin/env bash
# Marketplace production operations (docs/DEPLOYMENT.md). Same AWS account as Insurance Hub, separate del-marketplace-*
# resources created by infra/terraform; nothing here reads, changes or deletes an insuranceprep-* resource.
#
#   ./scripts/deploy-aws.sh plan                     read-only: terraform plan
#   ./scripts/deploy-aws.sh build [TAG]              build the API image and one web image per stack, push to ECR
#   ./scripts/deploy-aws.sh release STACK [TAG]      STACK = staging | production; deploys through SSM Run Command
#   ./scripts/deploy-aws.sh verify STACK             health and HTTPS checks
#   ./scripts/deploy-aws.sh seed-staging             synthetic demo data on staging only (never production)
#   ./scripts/deploy-aws.sh bootstrap-production     DEL platform instructor + first super admin (idempotent)
#
# Training videos are never uploaded by any of these commands (owner, 2026-11-25).
set -euo pipefail
cd "$(dirname "$0")/.."

APP=del-marketplace
REGION="${AWS_REGION:-us-east-1}"
DOMAIN="ai-devopseasylearning.com"
STAGING_HOST="staging.ai-devopseasylearning.com"
cmd="${1:-help}"
tag_default() { git rev-parse --short=12 HEAD; }
account() { aws sts get-caller-identity --query Account --output text; }
registry() { echo "$(account).dkr.ecr.${REGION}.amazonaws.com"; }
host_of() { [ "$1" = production ] && echo "$DOMAIN" || echo "$STAGING_HOST"; }
instance_id() {
  aws ec2 describe-instances --region "$REGION" --filters "Name=tag:App,Values=$APP" "Name=tag:Name,Values=$APP-app" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' --output text
}

# Runs a shell script on the server through SSM and prints its output; fails when the script fails.
remote() {
  local id script cid status
  id="$(instance_id)"; [ "$id" != "None" ] || { echo "no running $APP instance" >&2; exit 1; }
  script="$1"
  cid="$(aws ssm send-command --region "$REGION" --instance-ids "$id" --document-name AWS-RunShellScript --comment "${2:-del-marketplace}" \
    --timeout-seconds 1800 --parameters "$(python3 -c 'import json,sys;print(json.dumps({"commands":[sys.stdin.read()],"executionTimeout":["1800"]}))' <<<"$script")" \
    --query Command.CommandId --output text)"
  for _ in $(seq 1 180); do
    status="$(aws ssm get-command-invocation --region "$REGION" --command-id "$cid" --instance-id "$id" --query Status --output text 2>/dev/null || echo Pending)"
    case "$status" in Success|Failed|Cancelled|TimedOut) break ;; esac
    sleep 10
  done
  aws ssm get-command-invocation --region "$REGION" --command-id "$cid" --instance-id "$id" --query '[StandardOutputContent,StandardErrorContent]' --output text | tail -60
  [ "$status" = Success ] || { echo "remote command $status" >&2; exit 1; }
}

b64() { base64 -w0 < "$1"; }

case "$cmd" in
  plan)
    (cd infra/terraform && terraform plan -input=false) ;;

  build)
    TAG="${2:-$(tag_default)}"; REG="$(registry)"
    aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REG" >/dev/null
    docker build -f apps/api/Dockerfile -t "$REG/$APP/api:$TAG" .
    docker push "$REG/$APP/api:$TAG"
    for stack in production staging; do
      docker build -f apps/web/Dockerfile --build-arg "NEXT_PUBLIC_API_URL=https://$(host_of $stack)/api" -t "$REG/$APP/web:$TAG-$stack" .
      docker push "$REG/$APP/web:$TAG-$stack"
    done
    echo "pushed $TAG" ;;

  release)
    STACK="${2:?staging or production}"; TAG="${3:-$(tag_default)}"
    [ "$STACK" = staging ] || [ "$STACK" = production ] || { echo "STACK must be staging or production" >&2; exit 1; }
    remote "set -euo pipefail
export HOME=/root
D=/srv/$APP; mkdir -p \$D/$STACK \$D/edge; chmod 700 \$D
echo '$(b64 docker-compose.prod.yml)' | base64 -d > \$D/$STACK/docker-compose.yml
echo '$(b64 deploy/edge.compose.yml)' | base64 -d > \$D/edge/docker-compose.yml
echo '$(b64 deploy/Caddyfile)' | base64 -d > \$D/edge/Caddyfile
umask 077
# secrets: SSM Parameter Store -> root-only .env (never in git or images)
aws ssm get-parameters-by-path --region $REGION --path /$APP/$STACK --with-decryption --query 'Parameters[].[Name,Value]' --output text \
  | while IFS=\$'\t' read -r n v; do printf '%s=%s\n' \"\${n##*/}\" \"\$v\"; done > \$D/$STACK/.env.new
mv \$D/$STACK/.env.new \$D/$STACK/.env
val() { grep -E \"^\$1=\" \$D/$STACK/.env | head -1 | cut -d= -f2-; }
ECR_REGISTRY=\$(val ECR_REGISTRY); PUBLIC_HOST=\$(val PUBLIC_HOST); ACME_EMAIL=\$(val ACME_EMAIL); DATABASE_URL=\$(val DATABASE_URL)
docker network inspect edge >/dev/null 2>&1 || docker network create edge
# the staging database lives on the same RDS instance, created once
if [ '$STACK' = staging ]; then
  ADMIN_URL=\"\${DATABASE_URL%/*}/marketplace\"
  docker run --rm postgres:16-alpine psql \"\$ADMIN_URL\" -tAc \"select 1 from pg_database where datname='marketplace_staging'\" | grep -q 1 \
    || docker run --rm postgres:16-alpine psql \"\$ADMIN_URL\" -c 'create database marketplace_staging'
fi
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin \$ECR_REGISTRY >/dev/null
cd \$D/$STACK
export STACK=$STACK IMAGE_TAG=$TAG ECR_REGISTRY PUBLIC_HOST
docker compose -p del-$STACK pull
docker compose -p del-$STACK up -d --remove-orphans
for i in \$(seq 1 40); do [ \"\$(docker inspect -f '{{.State.Health.Status}}' del-$STACK-api-1 2>/dev/null)\" = healthy ] && break; sleep 6; done
docker inspect -f '{{.State.Health.Status}}' del-$STACK-api-1
cd \$D/edge
DOMAIN=$DOMAIN STAGING_HOST=$STAGING_HOST ACME_EMAIL=\$ACME_EMAIL docker compose -p del-edge up -d
docker exec del-edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null || true
docker image prune -af --filter until=168h >/dev/null || true
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'del-' " "release $STACK $TAG" ;;

  verify)
    STACK="${2:?staging or production}"; H="$(host_of "$STACK")"
    for i in $(seq 1 30); do
      if curl -fsS --max-time 10 "https://$H/api/health" >/dev/null && curl -fsS --max-time 15 -o /dev/null "https://$H/"; then
        echo "healthy: https://$H"; curl -sI "http://$H/" | grep -iE '^(HTTP|location)' | head -2; exit 0
      fi
      sleep 10
    done
    echo "https://$H is not healthy after 5 minutes" >&2; exit 1 ;;

  seed-staging)
    remote "set -euo pipefail
cd /srv/$APP/staging
docker compose -p del-staging exec -T api npm run seed" "seed staging" ;;

  bootstrap-production)
    P="/$APP/bootstrap/ADMIN_PASSWORD"; E="/$APP/bootstrap/ADMIN_EMAIL"
    if ! aws ssm get-parameter --region "$REGION" --name "$P" >/dev/null 2>&1; then
      aws ssm put-parameter --region "$REGION" --name "$P" --type SecureString --value "$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-28)" >/dev/null
      aws ssm put-parameter --region "$REGION" --name "$E" --type SecureString --value "support@devopseasylearning.com" >/dev/null
    fi
    remote "set -euo pipefail
cd /srv/$APP/production
docker compose -p del-production exec -T \
  -e BOOTSTRAP_ADMIN_EMAIL=\"\$(aws ssm get-parameter --region $REGION --name $E --with-decryption --query Parameter.Value --output text)\" \
  -e BOOTSTRAP_ADMIN_PASSWORD=\"\$(aws ssm get-parameter --region $REGION --name $P --with-decryption --query Parameter.Value --output text)\" \
  api node dist/ops/bootstrap.js" "bootstrap production" ;;

  *) sed -n '2,13p' "$0" ;;
esac
