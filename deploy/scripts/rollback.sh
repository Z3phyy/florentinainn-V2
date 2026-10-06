#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env_file
cd "$APP_DIR"

for image in florentina-backend florentina-frontend; do
  if ! docker image inspect "$image:previous" >/dev/null 2>&1; then
    echo "No $image:previous image found; roll back with git instead (see DEPLOYMENT.md)." >&2
    exit 1
  fi
done

for image in florentina-backend florentina-frontend; do
  docker tag "$image:previous" "$image:latest"
done

compose up -d --no-build --force-recreate frontend backend

if wait_for_healthy 180; then
  compose ps
  echo "Rolled back to previous images."
else
  compose logs --tail=80 backend frontend
  echo "Rollback containers are not healthy; check the logs above." >&2
  exit 1
fi
