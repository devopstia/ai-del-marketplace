#!/usr/bin/env bash
# Create .env from .env.example with random local secrets. Refuses to overwrite an existing .env.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && { echo ".env already exists."; exit 1; }
umask 077
r() { openssl rand -hex "$1"; }
seed="Demo-$(r 4)"
sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(r 16)|" \
    -e "s|^SESSION_SECRET=.*|SESSION_SECRET=$(r 32)|" \
    -e "s|^S3_ACCESS_KEY=.*|S3_ACCESS_KEY=del$(r 6)|" \
    -e "s|^S3_SECRET_KEY=.*|S3_SECRET_KEY=$(r 20)|" \
    -e "s|^SEED_PASSWORD=.*|SEED_PASSWORD=$seed|" \
    -e "s|^SEED_MFA_SECRET=.*|SEED_MFA_SECRET=$(openssl rand 20 | base32 | tr -d '=\n')|" \
    -e "s|^OAUTH_TEST_PROVIDER=.*|OAUTH_TEST_PROVIDER=true|" .env.example > .env
echo ".env created. Seed accounts sign in with: $seed, and the authenticator seed SEED_MFA_SECRET in .env (docs/AUTH.md)."
