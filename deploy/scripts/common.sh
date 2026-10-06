#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
MONGO_TOOLS_IMAGE="${MONGO_TOOLS_IMAGE:-mongo:8}"
MONGO_TOOLS_NETWORK="${MONGO_TOOLS_NETWORK:-bridge}"
SERVICES=(backend frontend)

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

read_env() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  printf '%s' "$value"
}

require_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "Missing $ENV_FILE. Copy .env.production.example to .env.production and fill it in." >&2
    exit 1
  fi
}

wait_for_healthy() {
  local timeout="${1:-180}"
  local elapsed=0
  local service id status all_ok
  while [ "$elapsed" -lt "$timeout" ]; do
    all_ok=1
    for service in "${SERVICES[@]}"; do
      id="$(compose ps -q "$service")"
      status="$( [ -n "$id" ] && docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" || echo missing)"
      if [ "$status" != "healthy" ]; then
        all_ok=0
      fi
    done
    if [ "$all_ok" -eq 1 ]; then
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done
  return 1
}
