#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env_file
MONGODB_URI="$(read_env MONGODB_URI)"
if [ -z "$MONGODB_URI" ]; then
  echo "MONGODB_URI is empty in $ENV_FILE" >&2
  exit 1
fi
export MONGODB_URI

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="florentina-${STAMP}.archive.gz"

echo "Backing up MongoDB to $BACKUP_DIR/$FILE"
docker run --rm \
  --network "$MONGO_TOOLS_NETWORK" \
  --user "$(id -u):$(id -g)" \
  -e MONGODB_URI \
  -v "$BACKUP_DIR:/backup" \
  "$MONGO_TOOLS_IMAGE" \
  sh -c "mongodump --uri=\"\$MONGODB_URI\" --gzip --archive=/backup/$FILE"

if [ ! -s "$BACKUP_DIR/$FILE" ] || ! gzip -t "$BACKUP_DIR/$FILE"; then
  echo "Backup verification FAILED for $BACKUP_DIR/$FILE" >&2
  exit 1
fi
chmod 600 "$BACKUP_DIR/$FILE"

KEEP="${BACKUP_KEEP:-30}"
ls -1t "$BACKUP_DIR"/florentina-*.archive.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

echo "Backup OK: $BACKUP_DIR/$FILE ($(du -h "$BACKUP_DIR/$FILE" | cut -f1))"
