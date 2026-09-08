#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

PREVIOUS_BUILD=""
if [[ -d .next ]]; then
  PREVIOUS_BUILD="/tmp/taskmanager-next-$(date -u +%Y%m%dT%H%M%SZ)"
  cp -a .next "$PREVIOUS_BUILD"
fi

rollback() {
  if [[ -n "$PREVIOUS_BUILD" && -d "$PREVIOUS_BUILD" ]]; then
    rm -rf .next
    cp -a "$PREVIOUS_BUILD" .next
    pm2 startOrReload ecosystem.config.cjs --env production
    echo "Deployment rolled back to the previous build." >&2
  fi
}

trap rollback ERR

scripts/build-production.sh
scripts/migrate-production.sh
pm2 startOrReload ecosystem.config.cjs --env production
scripts/health-check.sh

trap - ERR
if [[ -n "$PREVIOUS_BUILD" && -d "$PREVIOUS_BUILD" ]]; then
  rm -rf "$PREVIOUS_BUILD"
fi
echo "Deployment completed successfully."
