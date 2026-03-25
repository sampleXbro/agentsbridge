#!/usr/bin/env bash
set -euo pipefail

if [ -n "${FILE_PATH:-}" ] && [ -f "$FILE_PATH" ]; then
  pnpm exec eslint --fix "$FILE_PATH"
fi
