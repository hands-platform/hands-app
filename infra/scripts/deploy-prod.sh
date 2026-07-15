#!/usr/bin/env sh
set -eu

ENV_FILE="${ENV_FILE:-.env}"
SKIP_BUILD="${SKIP_BUILD:-0}"
RUN_SEED="${RUN_SEED:-0}"
SKIP_SMOKE="${SKIP_SMOKE:-0}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

step() {
  printf '\n==> %s\n' "$1"
}

command -v docker >/dev/null 2>&1 || {
  echo "Docker is not installed or not available on PATH." >&2
  exit 1
}

command -v node >/dev/null 2>&1 || {
  echo "Node.js is not installed or not available on PATH." >&2
  exit 1
}

step "Validate environment"
node infra/scripts/check-env.mjs "$ENV_FILE"

export HANDS_ENV_FILE="$ENV_FILE"
compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

if [ "$SKIP_BUILD" = "1" ]; then
  echo "Using existing production images."
else
  step "Build production images"
  compose build
fi

step "Start production data services"
compose up -d postgres redis minio

step "Run Prisma migrations"
compose run --rm api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

step "Start production application services"
compose up -d

if [ "$RUN_SEED" = "1" ]; then
  step "Seed demo data"
  compose exec api npm run prisma:seed --workspace @massage-vn/api
fi

if [ "$SKIP_SMOKE" != "1" ]; then
  step "Run E2E smoke script"
  API_BASE_URL="${API_BASE_URL:-http://localhost/api}" node infra/scripts/api-smoke.mjs
fi

printf '\nDeployment flow completed.\n'
