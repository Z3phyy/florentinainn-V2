#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

usage() {
  echo "Usage:"
  echo "  $0 <backup-file>                 Restore into a NEW database (live data untouched)"
  echo "  $0 <backup-file> --replace-live  Replace the live database (asks for confirmation)"
  exit 1
}

[ $# -ge 1 ] || usage
ARCHIVE="$(realpath "$1")"
MODE="${2:-}"
[ -f "$ARCHIVE" ] || { echo "Backup file not found: $ARCHIVE" >&2; exit 1; }
gzip -t "$ARCHIVE" || { echo "Backup file is corrupt: $ARCHIVE" >&2; exit 1; }

require_env_file
MONGODB_URI="$(read_env MONGODB_URI)"
LIVE_DB="$(read_env MONGODB_DATABASE)"
[ -n "$MONGODB_URI" ] || { echo "MONGODB_URI is empty" >&2; exit 1; }
[ -n "$LIVE_DB" ] || { echo "MONGODB_DATABASE is empty in $ENV_FILE" >&2; exit 1; }
export MONGODB_URI

ARCHIVE_DIR="$(dirname "$ARCHIVE")"
ARCHIVE_NAME="$(basename "$ARCHIVE")"

run_restore() {
  docker run --rm \
    --network "$MONGO_TOOLS_NETWORK" \
    -e MONGODB_URI \
    -v "$ARCHIVE_DIR:/backup:ro" \
    "$MONGO_TOOLS_IMAGE" \
    sh -c "mongorestore --uri=\"\$MONGODB_URI\" --gzip --archive=/backup/$ARCHIVE_NAME $*"
}

if [ "$MODE" = "--replace-live" ]; then
  echo "WARNING: this will DROP and REPLACE every collection in the backup inside the LIVE database '$LIVE_DB'."
  read -r -p "Type the database name ($LIVE_DB) to continue: " CONFIRM
  [ "$CONFIRM" = "$LIVE_DB" ] || { echo "Aborted."; exit 1; }

  echo "Taking a safety backup of the current live data first..."
  "$(dirname "${BASH_SOURCE[0]}")/backup-mongo.sh"

  echo "Stopping application containers..."
  compose stop frontend backend

  run_restore "--nsInclude='${LIVE_DB}.*' --drop"

  echo "Starting application containers..."
  compose up -d
  echo "Live restore finished."
elif [ -z "$MODE" ]; then
  TARGET_DB="${LIVE_DB}_restore_$(date -u +%Y%m%dT%H%M%SZ)"
  run_restore "--nsInclude='${LIVE_DB}.*' --nsFrom='${LIVE_DB}.*' --nsTo='${TARGET_DB}.*'"
  echo "Restored into separate database: $TARGET_DB"
  echo "Live database '$LIVE_DB' was NOT modified."
else
  usage
fi
