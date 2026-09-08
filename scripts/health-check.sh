#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8502}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/health}"
MAX_ATTEMPTS="${HEALTH_MAX_ATTEMPTS:-30}"

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1)); do
  if curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" >/dev/null; then
    echo "Health check passed: $HEALTH_URL"
    exit 0
  fi
  sleep 2
done

echo "Health check failed after ${MAX_ATTEMPTS} attempts: $HEALTH_URL" >&2
exit 1
