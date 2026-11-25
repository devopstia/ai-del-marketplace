#!/usr/bin/env bash
# Marketplace production operations (docs/DEPLOYMENT.md). Same AWS account as Insurance Hub, separate resources,
# all named del-marketplace-*; nothing here reads, changes or deletes an insuranceprep-* resource.
#
#   ./scripts/deploy-aws.sh plan       read-only: what exists, what would be created, rough monthly cost
#   ./scripts/deploy-aws.sh release    (pipeline) pull IMAGE_TAG on the server via SSM Run Command and restart
#   ./scripts/deploy-aws.sh verify     health check of https://$PUBLIC_HOST
#
# Provisioning (VPC/security group, EC2, RDS, S3, ECR, SES/Resend DNS, OIDC roles, SSM parameters) is listed in
# docs/DEPLOYMENT.md and runs only after the owner authorises production and gives the domain (owner, 2026-11-25).
set -euo pipefail

APP=del-marketplace
AWS_REGION="${AWS_REGION:-us-east-1}"
PARAM_PREFIX="/${APP}/prod"
cmd="${1:-help}"

need() { command -v "$1" >/dev/null || { echo "missing: $1" >&2; exit 1; }; }

plan() {
  need aws
  echo "Account: $(aws sts get-caller-identity --query Account --output text) (expected: the Insurance Hub account)"
  echo "Region:  $AWS_REGION"
  echo
  echo "Existing marketplace resources (none expected before approval):"
  aws ec2 describe-instances --region "$AWS_REGION" --filters "Name=tag:App,Values=$APP" "Name=instance-state-name,Values=pending,running,stopped" \
    --query 'Reservations[].Instances[].[InstanceId,InstanceType,State.Name]' --output text || true
  aws rds describe-db-instances --region "$AWS_REGION" --query "DBInstances[?starts_with(DBInstanceIdentifier,'$APP')].[DBInstanceIdentifier,DBInstanceClass]" --output text || true
  aws s3api list-buckets --query "Buckets[?starts_with(Name,'$APP')].Name" --output text || true
  aws ecr describe-repositories --region "$AWS_REGION" --query "repositories[?starts_with(repositoryName,'$APP/')].repositoryName" --output text 2>/dev/null || true
  aws ssm get-parameters-by-path --region "$AWS_REGION" --path "$PARAM_PREFIX" --query 'Parameters[].Name' --output text 2>/dev/null || true
  cat <<PLAN

Would create after approval (all tagged App=$APP, nothing shared with Insurance Hub except the account):
  EC2   t4g.medium (arm64) + Elastic IP + security group (80/443 open to the world; no SSH, SSM only)
  RDS   PostgreSQL 16, db.t4g.micro, 20 GB gp3, encrypted, 7-day backups ($APP-rds)
  S3    $APP-media-<account> (private, encrypted, CORS for the domain, lifecycle for incomplete uploads)
  ECR   $APP/api, $APP/web (keep 10 images)
  IAM   instance role (S3 bucket + SSM parameters + ECR pull only), GitHub OIDC roles $APP-gh-images/$APP-gh-deploy
  SSM   SecureString parameters under $PARAM_PREFIX/ (application secrets)
  DNS   records for the owner's domain; Resend sending domain (SPF, DKIM, DMARC)
Rough cost: EC2 ~25 USD, RDS ~15 USD, S3/transfer depends on video traffic, ECR/SSM ~1 USD per month.
PLAN
}

release() {
  need aws
  : "${IMAGE_TAG:?IMAGE_TAG required}"
  local id
  id="$(aws ec2 describe-instances --region "$AWS_REGION" --filters "Name=tag:App,Values=$APP" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].InstanceId' --output text)"
  [ "$id" != "None" ] || { echo "no running $APP instance" >&2; exit 1; }
  # On the server: secrets from SSM into a root-only .env, pull the tagged images, migrate and restart.
  local script
  script=$(cat <<REMOTE
set -euo pipefail
cd /srv/$APP
umask 077
aws ssm get-parameters-by-path --region $AWS_REGION --path $PARAM_PREFIX --with-decryption --query 'Parameters[].[Name,Value]' --output text \
  | while IFS=\$'\t' read -r n v; do printf '%s=%s\n' "\${n##*/}" "\$v"; done > .env.new && mv .env.new .env
export IMAGE_TAG=$IMAGE_TAG ECR_REGISTRY=\$(grep ^ECR_REGISTRY= .env | cut -d= -f2-) PUBLIC_HOST=\$(grep ^PUBLIC_HOST= .env | cut -d= -f2-) ACME_EMAIL=\$(grep ^ACME_EMAIL= .env | cut -d= -f2-)
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "\$ECR_REGISTRY"
git fetch --quiet origin && git checkout --quiet "$IMAGE_TAG" -- docker-compose.prod.yml deploy/Caddyfile || true
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker image prune -f >/dev/null
REMOTE
)
  local cid
  cid="$(aws ssm send-command --region "$AWS_REGION" --instance-ids "$id" --document-name AWS-RunShellScript \
    --comment "release $IMAGE_TAG" --parameters "commands=[$(printf '%s' "$script" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')]" \
    --query Command.CommandId --output text)"
  aws ssm wait command-executed --region "$AWS_REGION" --command-id "$cid" --instance-id "$id" || true
  aws ssm get-command-invocation --region "$AWS_REGION" --command-id "$cid" --instance-id "$id" --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
}

verify() {
  : "${PUBLIC_HOST:=$(aws ssm get-parameter --region "$AWS_REGION" --name "$PARAM_PREFIX/PUBLIC_HOST" --query Parameter.Value --output text)}"
  for i in $(seq 1 30); do
    if curl -fsS --max-time 10 "https://$PUBLIC_HOST/api/health" >/dev/null && curl -fsS --max-time 10 -o /dev/null "https://$PUBLIC_HOST/"; then echo "healthy: https://$PUBLIC_HOST"; return 0; fi
    sleep 10
  done
  echo "not healthy after 5 minutes" >&2; exit 1
}

case "$cmd" in
  plan) plan ;;
  release) release ;;
  verify) verify ;;
  *) sed -n '2,12p' "$0" ;;
esac
