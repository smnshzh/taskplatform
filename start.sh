#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

exec env NODE_ENV=production PORT="${PORT:-8502}" node .next/standalone/server.js
