#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

main() {
  require_env_file
  cd "$APP_DIR"

  compose config --quiet

  if [ "${SKIP_BACKUP:-0}" != "1" ]; then
    "$APP_DIR/deploy/scripts/backup-mongo.sh"
  fi

  if [ "${SKIP_PULL:-0}" != "1" ]; then
    git pull --ff-only
  fi
  echo "Deploying commit $(git rev-parse --short HEAD)"

  for image in florentina-backend florentina-frontend; do
    if docker image inspect "$image:latest" >/dev/null 2>&1; then
      docker tag "$image:latest" "$image:previous"
    fi
  done

  compose build --pull
  compose up -d

  if wait_for_healthy 180; then
    compose ps
    docker image prune -f >/dev/null
    echo "Deployment healthy."
  else
    compose ps
    compose logs --tail=80 backend frontend
    echo "Deployment did NOT become healthy. To roll back run: ./deploy/scripts/rollback.sh" >&2
    exit 1
  fi
}

main "$@"
exit $?
